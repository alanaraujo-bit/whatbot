import { ApiError, handle, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { publish } from "@/server/events";
import { getWhatsAppProvider } from "@/server/whatsapp";

export const dynamic = "force-dynamic";

/**
 * Inicia a conexão do WhatsApp.
 *
 * A resposta volta assim que o provider aceita o pedido; o QR Code e o estado
 * final chegam de forma assíncrona pelo webhook, e a UI acompanha via SSE.
 */
export async function POST() {
  return handle(async () => {
    const { workspaceId } = await requireAuth();

    const session = await prisma.whatsappSession.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
    if (!session) throw new ApiError("Sessão de WhatsApp não encontrada", 404);

    if (session.status === "CONNECTED") {
      return { status: session.status, phoneNumber: session.phoneNumber };
    }

    await prisma.whatsappSession.update({
      where: { id: session.id },
      data: { status: "CONNECTING", qrCode: null, lastError: null },
    });
    publish({ type: "session:updated", workspaceId, sessionId: session.id });

    try {
      const state = await getWhatsAppProvider().connect(session.id);

      const updated = await prisma.whatsappSession.update({
        where: { id: session.id },
        data: {
          status: state.status,
          qrCode: state.qrCode ?? null,
          phoneNumber: state.phoneNumber ?? undefined,
        },
      });
      publish({ type: "session:updated", workspaceId, sessionId: session.id });

      return { status: updated.status, qrCode: updated.qrCode };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Falha ao conectar";
      await prisma.whatsappSession.update({
        where: { id: session.id },
        data: { status: "FAILED", lastError: reason },
      });
      publish({ type: "session:updated", workspaceId, sessionId: session.id });
      throw new ApiError(reason, 502);
    }
  });
}
