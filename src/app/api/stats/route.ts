import { handle, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Números do topo do CRM: total por etapa, conversas abertas e não lidas. */
export async function GET() {
  return handle(async () => {
    const { workspaceId } = await requireAuth();

    const [byStage, openConversations, unread, totalContacts] = await Promise.all([
      prisma.contact.groupBy({
        by: ["stage"],
        where: { workspaceId },
        _count: { _all: true },
      }),
      prisma.conversation.count({ where: { workspaceId, status: "OPEN" } }),
      prisma.conversation.count({ where: { workspaceId, unreadCount: { gt: 0 } } }),
      prisma.contact.count({ where: { workspaceId } }),
    ]);

    return {
      stages: Object.fromEntries(byStage.map((row) => [row.stage, row._count._all])),
      openConversations,
      unread,
      totalContacts,
    };
  });
}
