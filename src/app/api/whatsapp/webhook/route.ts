import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { publish } from "@/server/events";
import { ingestInboundMessage } from "@/server/messaging";
import type { WebhookEvent } from "@/server/whatsapp/types";

export const dynamic = "force-dynamic";

/**
 * Webhook do micro-serviço de WhatsApp.
 *
 * Esta rota é EXCLUÍDA do middleware de autenticação (não há usuário logado
 * numa chamada máquina-a-máquina), então a proteção é o token compartilhado.
 * Sem ele, qualquer um na rede poderia injetar mensagens falsas no CRM.
 */
export async function POST(request: Request) {
  const token = request.headers.get("x-service-token");
  const expected = process.env.WHATSAPP_SERVICE_TOKEN;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let event: WebhookEvent;
  try {
    event = (await request.json()) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // O micro-serviço só conhece o sessionId; o workspace vem do banco.
  const session = await prisma.whatsappSession.findUnique({
    where: { id: event.sessionId },
    select: { id: true, workspaceId: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Sessão desconhecida" }, { status: 404 });
  }

  try {
    switch (event.type) {
      case "status":
        await handleStatus(session.workspaceId, event);
        break;
      case "message":
        await ingestInboundMessage(session.workspaceId, session.id, event.message);
        break;
      case "message-status":
        await handleMessageStatus(session.workspaceId, event);
        break;
    }
  } catch (error) {
    console.error("[webhook] falha ao processar evento:", error);
    return NextResponse.json({ error: "Falha ao processar evento" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function handleStatus(
  workspaceId: string,
  event: Extract<WebhookEvent, { type: "status" }>
): Promise<void> {
  await prisma.whatsappSession.update({
    where: { id: event.sessionId },
    data: {
      status: event.status,
      // QR só existe enquanto aguarda leitura; limpamos assim que sai desse estado.
      qrCode: event.status === "QR_PENDING" ? (event.qrCode ?? null) : null,
      phoneNumber: event.phoneNumber ?? undefined,
      profileName: event.profileName ?? undefined,
      lastError: event.error ?? null,
      lastConnectedAt: event.status === "CONNECTED" ? new Date() : undefined,
    },
  });

  publish({ type: "session:updated", workspaceId, sessionId: event.sessionId });
}

async function handleMessageStatus(
  workspaceId: string,
  event: Extract<WebhookEvent, { type: "message-status" }>
): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { workspaceId_externalId: { workspaceId, externalId: event.externalId } },
    select: { id: true, conversationId: true, status: true },
  });
  if (!message) return;

  // Confirmações chegam fora de ordem; nunca regride READ -> DELIVERED.
  const rank = { PENDING: 0, FAILED: 0, SENT: 1, DELIVERED: 2, READ: 3 } as const;
  if (rank[event.status] <= rank[message.status]) return;

  await prisma.message.update({
    where: { id: message.id },
    data: { status: event.status },
  });

  publish({ type: "message:new", workspaceId, conversationId: message.conversationId });
}
