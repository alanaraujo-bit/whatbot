import type { WhatsappSession } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * A sessão de WhatsApp "principal" do workspace.
 *
 * Um workspace pode acumular mais de um registro de sessão (uma tentativa que
 * falhou, mais a que de fato pareou). Escolher simplesmente a mais antiga fazia
 * o painel exibir "Falhou" enquanto o WhatsApp estava conectado e recebendo
 * mensagens normalmente.
 *
 * A preferência segue o quanto a sessão está utilizável, e não a idade. Não dá
 * para resolver isso com `orderBy` no enum: o Postgres ordena pela ordem de
 * declaração, que colocaria DISCONNECTED na frente de CONNECTED.
 */
const STATUS_PRIORITY = ["CONNECTED", "QR_PENDING", "CONNECTING", "DISCONNECTED", "FAILED"] as const;

export async function getPrimarySession(workspaceId: string): Promise<WhatsappSession | null> {
  const sessions = await prisma.whatsappSession.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });

  if (sessions.length === 0) return null;

  return [...sessions].sort(
    (a, b) => STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status)
  )[0];
}

/** Igual ao anterior, mas cria a sessão quando o workspace ainda não tem nenhuma. */
export async function getOrCreatePrimarySession(workspaceId: string): Promise<WhatsappSession> {
  const existing = await getPrimarySession(workspaceId);
  if (existing) return existing;

  return prisma.whatsappSession.create({
    data: { name: "Número principal", workspaceId },
  });
}
