import { handle, parseBody, requireAuth } from "@/lib/api";
import { sendMessageSchema } from "@/lib/validations";
import { sendTextMessage } from "@/server/messaging";

export const dynamic = "force-dynamic";

/** Envia uma mensagem de texto na conversa. */
export async function POST(request: Request) {
  return handle(async () => {
    const { workspaceId, userId } = await requireAuth();
    const { conversationId, content } = await parseBody(request, sendMessageSchema);

    const message = await sendTextMessage({
      workspaceId,
      conversationId,
      content: content.trim(),
      userId,
    });

    return { message };
  });
}
