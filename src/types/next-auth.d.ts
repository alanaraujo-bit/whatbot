import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Estende a sessão do NextAuth com os campos multi-tenant do Wapply.
 * `workspaceId` no token evita uma query ao banco em toda requisição.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      workspaceId: string;
      workspaceName: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    workspaceId?: string;
    workspaceName?: string;
    role?: UserRole;
  }
}

/**
 * O JWT precisa ser aumentado em `@auth/core/jwt`, não em `next-auth/jwt`:
 * este último apenas reexporta aquele, e module augmentation não atravessa
 * reexports.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    workspaceId: string;
    workspaceName: string;
    role: UserRole;
  }
}

export {};
