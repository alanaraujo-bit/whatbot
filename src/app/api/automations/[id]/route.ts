import { ApiError, handle, parseBody, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { automationSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const { id } = await params;

    // `_def.schema` alcança o objeto por baixo do `.refine()` para poder usar `.partial()`.
    const data = await parseBody(request, automationSchema._def.schema.partial());

    const existing = await prisma.automation.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!existing) throw new ApiError("Automação não encontrada", 404);

    const automation = await prisma.automation.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        trigger: data.trigger,
        keyword:
          data.trigger === "ANY_MESSAGE"
            ? null
            : data.keyword !== undefined
              ? data.keyword.trim() || null
              : undefined,
        response: data.response?.trim(),
        isActive: data.isActive,
        priority: data.priority,
        onlyFirstMessage: data.onlyFirstMessage,
      },
    });

    return { automation };
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const { id } = await params;

    const existing = await prisma.automation.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!existing) throw new ApiError("Automação não encontrada", 404);

    await prisma.automation.delete({ where: { id } });
    return { ok: true };
  });
}
