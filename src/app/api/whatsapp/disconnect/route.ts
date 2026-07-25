import { ApiError, handle, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { publish } from "@/server/events";
import { getWhatsAppProvider } from "@/server/whatsapp";

export const dynamic = "force-dynamic";

/**
 * Desconecta o WhatsApp.
 *
 * `?logout=true` também apaga as credenciais no micro-serviço, exigindo novo
 * QR Code na próxima conexão. Sem o parâmetro, só derruba o socket.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const shouldLogout = new URL(request.url).searchParams.get("logout") === "true";

    const session = await prisma.whatsappSession.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
    if (!session) throw new ApiError("Sessão de WhatsApp não encontrada", 404);

    const provider = getWhatsAppProvider();
    try {
      if (shouldLogout) {
        await provider.logout(session.id);
      } else {
        await provider.disconnect(session.id);
      }
    } catch (error) {
      // O micro-serviço pode já ter perdido a sessão. Seguimos e limpamos o banco:
      // deixar o registro como CONNECTED seria pior que uma desconexão otimista.
      console.warn("[whatsapp] erro ao desconectar no provider:", error);
    }

    await prisma.whatsappSession.update({
      where: { id: session.id },
      data: {
        status: "DISCONNECTED",
        qrCode: null,
        lastError: null,
        ...(shouldLogout ? { phoneNumber: null, profileName: null } : {}),
      },
    });
    publish({ type: "session:updated", workspaceId, sessionId: session.id });

    return { ok: true };
  });
}
