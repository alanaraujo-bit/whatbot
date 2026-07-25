import { ApiError, handle, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { publish } from "@/server/events";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Conversa completa: contato, etiquetas, notas e histórico de mensagens. */
export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const { id } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: { id, workspaceId },
      include: {
        contact: {
          include: {
            tags: { select: { id: true, name: true, color: true } },
            internalNotes: {
              orderBy: { createdAt: "desc" },
              include: { author: { select: { id: true, name: true } } },
            },
          },
        },
        assignedTo: { select: { id: true, name: true } },
        messages: {
          orderBy: { timestamp: "asc" },
          // Limite defensivo: conversas antigas podem ter milhares de mensagens.
          take: 300,
          include: { sentBy: { select: { id: true, name: true } } },
        },
      },
    });

    if (!conversation) throw new ApiError("Conversa não encontrada", 404);

    // Abrir a conversa zera o contador de não lidas.
    if (conversation.unreadCount > 0) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { unreadCount: 0 },
      });
      publish({ type: "conversation:updated", workspaceId, conversationId: conversation.id });
    }

    return { conversation: { ...conversation, unreadCount: 0 } };
  });
}

/** Atualiza status / responsável / fixado. */
export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const { id } = await params;

    const body = (await request.json()) as {
      status?: "OPEN" | "PENDING" | "CLOSED";
      isPinned?: boolean;
      assignedToId?: string | null;
    };

    const existing = await prisma.conversation.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!existing) throw new ApiError("Conversa não encontrada", 404);

    const conversation = await prisma.conversation.update({
      where: { id },
      data: {
        status: body.status,
        isPinned: body.isPinned,
        assignedToId: body.assignedToId,
      },
    });

    publish({ type: "conversation:updated", workspaceId, conversationId: id });

    return { conversation };
  });
}
