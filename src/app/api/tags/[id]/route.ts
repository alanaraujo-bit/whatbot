import { ApiError, handle, parseBody, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { tagSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const { id } = await params;
    const data = await parseBody(request, tagSchema.partial());

    const existing = await prisma.tag.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!existing) throw new ApiError("Etiqueta não encontrada", 404);

    const tag = await prisma.tag.update({
      where: { id },
      data: { name: data.name?.trim(), color: data.color },
    });

    return { tag };
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const { id } = await params;

    const existing = await prisma.tag.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!existing) throw new ApiError("Etiqueta não encontrada", 404);

    // A relação N:N some junto; os contatos permanecem.
    await prisma.tag.delete({ where: { id } });
    return { ok: true };
  });
}
