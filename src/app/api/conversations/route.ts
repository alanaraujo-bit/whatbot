import type { Prisma } from "@prisma/client";

import { handle, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Lista as conversas do workspace para a coluna 1 do chat.
 *
 * Suporta busca por nome/telefone e filtro por status. Os dados vêm
 * desnormalizados (prévia + horário na própria conversa) para não precisar de
 * um JOIN com mensagens a cada render da lista.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const params = new URL(request.url).searchParams;

    const search = params.get("search")?.trim() ?? "";
    const status = params.get("status");
    const tagId = params.get("tagId");
    const take = Math.min(Number(params.get("limit") ?? 100), 200);

    const where: Prisma.ConversationWhereInput = { workspaceId };

    if (status && status !== "ALL") {
      where.status = status as Prisma.ConversationWhereInput["status"];
    }

    if (search) {
      where.contact = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search.replace(/\D/g, "") } },
        ],
      };
    }

    if (tagId) {
      where.contact = { ...(where.contact as object), tags: { some: { id: tagId } } };
    }

    const conversations = await prisma.conversation.findMany({
      where,
      take,
      orderBy: [{ isPinned: "desc" }, { lastMessageAt: { sort: "desc", nulls: "last" } }],
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            avatarUrl: true,
            stage: true,
            tags: { select: { id: true, name: true, color: true } },
          },
        },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    return { conversations };
  });
}
