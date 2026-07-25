import type { Prisma } from "@prisma/client";

import { ApiError, handle, parseBody, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toInternational } from "@/lib/phone";
import { contactSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/** Lista contatos com busca e filtro por etapa do CRM. */
export async function GET(request: Request) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const params = new URL(request.url).searchParams;

    const search = params.get("search")?.trim() ?? "";
    const stage = params.get("stage");

    const where: Prisma.ContactWhereInput = { workspaceId };

    if (stage && stage !== "ALL") {
      where.stage = stage as Prisma.ContactWhereInput["stage"];
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { phone: { contains: search.replace(/\D/g, "") } },
      ];
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 300,
      include: {
        tags: { select: { id: true, name: true, color: true } },
        conversations: { select: { id: true }, take: 1 },
      },
    });

    return { contacts };
  });
}

/** Cria um contato manualmente. */
export async function POST(request: Request) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const data = await parseBody(request, contactSchema);

    const phone = toInternational(data.phone);

    const duplicate = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId, phone } },
      select: { id: true, name: true },
    });
    if (duplicate) {
      throw new ApiError(`Já existe um contato com este telefone: ${duplicate.name}`, 409);
    }

    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        phone,
        email: data.email?.trim() || null,
        company: data.company?.trim() || null,
        notes: data.notes?.trim() || null,
        stage: data.stage ?? "NEW_LEAD",
        tags: data.tagIds?.length ? { connect: data.tagIds.map((id) => ({ id })) } : undefined,
      },
      include: { tags: true },
    });

    return { contact };
  });
}
