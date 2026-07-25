import { ApiError, handle, parseBody, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toInternational } from "@/lib/phone";
import { contactSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const { id } = await params;

    const contact = await prisma.contact.findFirst({
      where: { id, workspaceId },
      include: {
        tags: true,
        conversations: { select: { id: true, lastMessageAt: true }, take: 1 },
        internalNotes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    });

    if (!contact) throw new ApiError("Contato não encontrado", 404);
    return { contact };
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const { id } = await params;

    // `partial()` permite edições pontuais (ex.: só mudar a etapa no board).
    const data = await parseBody(request, contactSchema.partial());

    const existing = await prisma.contact.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!existing) throw new ApiError("Contato não encontrado", 404);

    if (data.phone) {
      const phone = toInternational(data.phone);
      const duplicate = await prisma.contact.findUnique({
        where: { workspaceId_phone: { workspaceId, phone } },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ApiError("Já existe outro contato com este telefone", 409);
      }
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        phone: data.phone ? toInternational(data.phone) : undefined,
        email: data.email !== undefined ? data.email.trim() || null : undefined,
        company: data.company !== undefined ? data.company.trim() || null : undefined,
        notes: data.notes !== undefined ? data.notes.trim() || null : undefined,
        stage: data.stage,
        // `set` substitui o conjunto inteiro — é o que o formulário envia.
        tags: data.tagIds ? { set: data.tagIds.map((tagId) => ({ id: tagId })) } : undefined,
      },
      include: { tags: true },
    });

    return { contact };
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const { id } = await params;

    const existing = await prisma.contact.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!existing) throw new ApiError("Contato não encontrado", 404);

    // Conversas e notas caem junto por onDelete: Cascade no schema.
    await prisma.contact.delete({ where: { id } });

    return { ok: true };
  });
}
