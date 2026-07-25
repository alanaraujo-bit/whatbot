import bcrypt from "bcryptjs";

import { ApiError, handle, parseBody, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema, profileSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/** Atualiza o nome do usuário. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const { userId } = await requireAuth();
    const data = await parseBody(request, profileSchema);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: data.name.trim() },
      select: { id: true, name: true, email: true },
    });

    return { user };
  });
}

/** Troca de senha (exige a senha atual). */
export async function PUT(request: Request) {
  return handle(async () => {
    const { userId } = await requireAuth();
    const data = await parseBody(request, changePasswordSchema);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new ApiError("Esta conta não usa senha", 400);
    }

    const matches = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!matches) throw new ApiError("Senha atual incorreta", 400);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(data.newPassword, 12) },
    });

    return { ok: true };
  });
}
