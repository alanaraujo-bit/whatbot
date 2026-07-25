import { ApiError, handle, parseBody, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { tagSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const { workspaceId } = await requireAuth();

    const tags = await prisma.tag.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      include: { _count: { select: { contacts: true } } },
    });

    return { tags };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const data = await parseBody(request, tagSchema);
    const name = data.name.trim();

    const duplicate = await prisma.tag.findUnique({
      where: { workspaceId_name: { workspaceId, name } },
      select: { id: true },
    });
    if (duplicate) throw new ApiError("Já existe uma etiqueta com este nome", 409);

    const tag = await prisma.tag.create({
      data: { workspaceId, name, color: data.color },
    });

    return { tag };
  });
}
