import { handle, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Estado da sessão de WhatsApp do workspace.
 *
 * Lê do banco (não do provider) para a UI poder consultar em polling curto
 * sem martelar o micro-serviço. Quem mantém o banco atualizado é o webhook.
 */
export async function GET() {
  return handle(async () => {
    const { workspaceId } = await requireAuth();

    let session = await prisma.whatsappSession.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });

    // Workspaces criados antes deste endpoint podem não ter sessão ainda.
    if (!session) {
      session = await prisma.whatsappSession.create({
        data: { name: "Número principal", workspaceId },
      });
    }

    return {
      id: session.id,
      name: session.name,
      status: session.status,
      qrCode: session.qrCode,
      phoneNumber: session.phoneNumber,
      profileName: session.profileName,
      lastError: session.lastError,
      lastConnectedAt: session.lastConnectedAt,
    };
  });
}
