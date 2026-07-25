import { ApiError, handle, parseBody, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { noteSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Cria uma nota interna no contato (nunca é enviada ao cliente). */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { workspaceId, userId } = await requireAuth();
    const { id } = await params;
    const { body } = await parseBody(request, noteSchema);

    const contact = await prisma.contact.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!contact) throw new ApiError("Contato não encontrado", 404);

    const note = await prisma.note.create({
      data: { workspaceId, contactId: id, authorId: userId, body: body.trim() },
      include: { author: { select: { id: true, name: true } } },
    });

    return { note };
  });
}
