import { ApiError, handle, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const { id } = await params;

    const note = await prisma.note.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!note) throw new ApiError("Nota não encontrada", 404);

    await prisma.note.delete({ where: { id } });
    return { ok: true };
  });
}
