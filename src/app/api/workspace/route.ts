import { z } from "zod";

import { ApiError, handle, parseBody, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const workspaceSettingsSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  agentSignatureEnabled: z.boolean().optional(),
  notificationSoundEnabled: z.boolean().optional(),
});

export async function GET() {
  return handle(async () => {
    const { workspaceId } = await requireAuth();

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        agentSignatureEnabled: true,
        notificationSoundEnabled: true,
      },
    });
    if (!workspace) throw new ApiError("Workspace não encontrado", 404);

    return { workspace };
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const { workspaceId, role } = await requireAuth();

    // Configuração vale para a equipe inteira; atendente não deve alterar.
    if (role === "AGENT") {
      throw new ApiError("Apenas administradores podem alterar as configurações", 403);
    }

    const data = await parseBody(request, workspaceSettingsSchema);

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: data.name?.trim(),
        agentSignatureEnabled: data.agentSignatureEnabled,
        notificationSoundEnabled: data.notificationSoundEnabled,
      },
      select: {
        id: true,
        name: true,
        agentSignatureEnabled: true,
        notificationSoundEnabled: true,
      },
    });

    return { workspace };
  });
}
