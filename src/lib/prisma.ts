import { PrismaClient } from "@prisma/client";

/**
 * Singleton do Prisma Client.
 *
 * Em desenvolvimento o Next faz hot-reload dos módulos, o que criaria uma nova
 * conexão a cada alteração e estouraria o pool do Postgres. Guardamos a
 * instância no escopo global para sobreviver ao reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
