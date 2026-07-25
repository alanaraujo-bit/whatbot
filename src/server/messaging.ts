import type { Conversation } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { jidToPhone, formatPhone, isGroupJid } from "@/lib/phone";
import { truncate } from "@/lib/utils";
import { findMatchingAutomation, recordAutomationTrigger } from "@/server/automations";
import { publish } from "@/server/events";
import { getWhatsAppProvider } from "@/server/whatsapp";
import type { WebhookEvent } from "@/server/whatsapp/types";

/**
 * Regras de negócio de mensageria.
 *
 * Este módulo é o único lugar que escreve em Message/Conversation. Tanto o
 * webhook (mensagem recebida) quanto a API do chat (mensagem enviada) passam
 * por aqui, o que mantém consistentes: deduplicação, contadores de não lidas,
 * prévia da última mensagem e emissão de eventos para a UI.
 */

const PREVIEW_LENGTH = 120;

/**
 * Encontra (ou cria) contato + conversa para um JID.
 *
 * O WhatsApp não avisa quando um número é "novo": a primeira mensagem de um
 * desconhecido já precisa virar contato para aparecer no CRM.
 */
export async function resolveConversation(params: {
  workspaceId: string;
  sessionId: string | null;
  remoteJid: string;
  pushName?: string | null;
  profilePicUrl?: string | null;
}): Promise<Conversation & { isNew: boolean }> {
  const { workspaceId, sessionId, remoteJid, pushName, profilePicUrl } = params;
  const phone = jidToPhone(remoteJid);

  const existing = await prisma.conversation.findUnique({
    where: { workspaceId_remoteJid: { workspaceId, remoteJid } },
  });

  if (existing) {
    // A conversa já existe, mas a foto pode ter mudado (ou nunca ter sido
    // buscada, no caso de contatos criados antes deste recurso).
    if (profilePicUrl) {
      await prisma.contact.updateMany({
        where: { workspaceId, phone, avatarUrl: { not: profilePicUrl } },
        data: { avatarUrl: profilePicUrl },
      });
    }
    return { ...existing, isNew: false };
  }

  const contact = await prisma.contact.upsert({
    where: { workspaceId_phone: { workspaceId, phone } },
    update: { avatarUrl: profilePicUrl ?? undefined },
    create: {
      workspaceId,
      phone,
      // Sem nome no perfil, usa o número formatado — melhor que "Desconhecido".
      name: pushName?.trim() || formatPhone(phone),
      avatarUrl: profilePicUrl ?? null,
    },
  });

  const conversation = await prisma.conversation.create({
    data: { workspaceId, sessionId, remoteJid, contactId: contact.id },
  });

  return { ...conversation, isNew: true };
}

/**
 * Processa uma mensagem recebida do WhatsApp.
 *
 * Idempotente: reentregas do webhook com o mesmo `externalId` são descartadas
 * (o WhatsApp reenvia eventos com frequência).
 */
export async function ingestInboundMessage(
  workspaceId: string,
  sessionId: string,
  message: Extract<WebhookEvent, { type: "message" }>["message"]
): Promise<void> {
  // Grupos e status/broadcast estão fora do escopo do MVP.
  if (isGroupJid(message.from)) return;

  const alreadyProcessed = await prisma.message.findUnique({
    where: { workspaceId_externalId: { workspaceId, externalId: message.externalId } },
    select: { id: true },
  });
  if (alreadyProcessed) return;

  const conversation = await resolveConversation({
    workspaceId,
    sessionId,
    remoteJid: message.from,
    pushName: message.pushName,
    profilePicUrl: message.profilePicUrl,
  });

  const messageCount = await prisma.message.count({
    where: { conversationId: conversation.id },
  });
  const isFirstMessage = messageCount === 0;

  const direction = message.fromMe ? "OUTBOUND" : "INBOUND";
  const timestamp = new Date(message.timestamp * 1000);

  await prisma.$transaction([
    prisma.message.create({
      data: {
        workspaceId,
        conversationId: conversation.id,
        externalId: message.externalId,
        direction,
        type: mapMediaType(message.mediaType),
        content: message.text,
        timestamp,
        status: "DELIVERED",
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessagePreview: truncate(message.text, PREVIEW_LENGTH),
        lastMessageAt: timestamp,
        // Mensagem enviada de outro device do próprio número não conta como não lida.
        unreadCount: direction === "INBOUND" ? { increment: 1 } : undefined,
        status: "OPEN",
        sessionId,
      },
    }),
  ]);

  publish({ type: "message:new", workspaceId, conversationId: conversation.id });
  publish({ type: "conversation:updated", workspaceId, conversationId: conversation.id });

  // Automações só respondem a mensagens do cliente.
  if (direction === "INBOUND") {
    await maybeRunAutomation(workspaceId, conversation.id, message.text, isFirstMessage);
  }
}

/** Avalia as regras e, se alguma casar, envia a resposta automática. */
async function maybeRunAutomation(
  workspaceId: string,
  conversationId: string,
  text: string,
  isFirstMessage: boolean
): Promise<void> {
  const automation = await findMatchingAutomation(workspaceId, text, isFirstMessage);
  if (!automation) return;

  try {
    await sendTextMessage({
      workspaceId,
      conversationId,
      content: automation.response,
      isAutomated: true,
    });
    await recordAutomationTrigger(automation.id);
  } catch (error) {
    // Falha na automação não pode derrubar a ingestão da mensagem do cliente.
    console.error(`[automation] falha ao responder (regra "${automation.name}"):`, error);
  }
}

/**
 * Envia uma mensagem de texto e persiste o registro.
 *
 * A mensagem é gravada como PENDING antes do envio: se o WhatsApp falhar, ela
 * fica visível no chat marcada como falha, em vez de sumir.
 */
export async function sendTextMessage(params: {
  workspaceId: string;
  conversationId: string;
  content: string;
  /** Agente responsável. Null em respostas automáticas. */
  userId?: string | null;
  isAutomated?: boolean;
  /** Nome exibido na assinatura. Quando ausente, não assina. */
  agentName?: string | null;
}) {
  const {
    workspaceId,
    conversationId,
    content,
    userId = null,
    isAutomated = false,
    agentName = null,
  } = params;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId },
    include: { session: true },
  });
  if (!conversation) {
    throw new Error("Conversa não encontrada");
  }

  /**
   * O texto que vai para o WhatsApp pode levar a assinatura do atendente,
   * mas o que guardamos é o texto puro: assinar no banco poluiria o histórico
   * e faria a assinatura aparecer duplicada se a mensagem fosse reenviada.
   */
  const outgoingText = agentName ? `*${agentName}:*\n${content}` : content;

  const message = await prisma.message.create({
    data: {
      workspaceId,
      conversationId,
      direction: "OUTBOUND",
      type: "TEXT",
      content,
      status: "PENDING",
      sentById: userId,
      isAutomated,
    },
    include: { sentBy: { select: { id: true, name: true } } },
  });

  // Prévia atualizada antes do envio: a UI mostra a mensagem imediatamente.
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessagePreview: truncate(content, PREVIEW_LENGTH),
      lastMessageAt: message.timestamp,
    },
  });

  publish({ type: "message:new", workspaceId, conversationId });
  publish({ type: "conversation:updated", workspaceId, conversationId });

  const sessionId = conversation.sessionId ?? (await findActiveSessionId(workspaceId));

  if (!sessionId) {
    await markFailed(message.id, "Nenhuma sessão de WhatsApp conectada");
    throw new Error(
      "Nenhum WhatsApp conectado. Vá em Configurações › WhatsApp e conecte um número."
    );
  }

  try {
    const provider = getWhatsAppProvider();
    const { externalId } = await provider.sendText(
      sessionId,
      conversation.remoteJid,
      outgoingText
    );

    const sent = await prisma.message.update({
      where: { id: message.id },
      data: { status: "SENT", externalId },
      include: { sentBy: { select: { id: true, name: true } } },
    });
    publish({ type: "message:new", workspaceId, conversationId });
    return sent;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Falha no envio";
    await markFailed(message.id, reason);
    publish({ type: "message:new", workspaceId, conversationId });
    throw new Error(reason);
  }
}

async function markFailed(messageId: string, reason: string): Promise<void> {
  console.error(`[messaging] envio falhou (${messageId}): ${reason}`);
  await prisma.message.update({
    where: { id: messageId },
    data: { status: "FAILED" },
  });
}

/** Sessão conectada do workspace, usada quando a conversa ainda não tem uma. */
async function findActiveSessionId(workspaceId: string): Promise<string | null> {
  const session = await prisma.whatsappSession.findFirst({
    where: { workspaceId, status: "CONNECTED" },
    select: { id: true },
  });
  return session?.id ?? null;
}

/** Traduz o tipo de mídia do provider para o enum do banco. */
function mapMediaType(mediaType?: string | null) {
  switch (mediaType) {
    case "image":
      return "IMAGE" as const;
    case "video":
      return "VIDEO" as const;
    case "audio":
      return "AUDIO" as const;
    case "document":
      return "DOCUMENT" as const;
    case "sticker":
      return "STICKER" as const;
    case "location":
      return "LOCATION" as const;
    case "contact":
      return "CONTACT" as const;
    default:
      return "TEXT" as const;
  }
}
