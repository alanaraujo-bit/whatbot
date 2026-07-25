import { handle, parseBody, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sendMessageSchema } from "@/lib/validations";
import { sendTextMessage } from "@/server/messaging";

export const dynamic = "force-dynamic";

/** Envia uma mensagem de texto na conversa. */
export async function POST(request: Request) {
  return handle(async () => {
    const { workspaceId, userId, name } = await requireAuth();
    const { conversationId, content } = await parseBody(request, sendMessageSchema);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { agentSignatureEnabled: true },
    });

    const message = await sendTextMessage({
      workspaceId,
      conversationId,
      content: content.trim(),
      userId,
      // Só o primeiro nome: assinatura curta polui menos a conversa.
      agentName: workspace?.agentSignatureEnabled ? name.split(/\s+/)[0] : null,
    });

    return { message };
  });
}
