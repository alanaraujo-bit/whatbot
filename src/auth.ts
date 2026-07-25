import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";

/**
 * Configuração completa do NextAuth (runtime Node).
 *
 * Para adicionar Google/Apple no futuro, basta acrescentar os providers no
 * array abaixo — o resto (sessão, JWT, callbacks) já está preparado:
 *
 *   import Google from "next-auth/providers/google";
 *   ...
 *   providers: [Credentials({...}), Google({ clientId: ..., clientSecret: ... })]
 *
 * Lembre de popular o model `Account` no callback `signIn` para vincular a
 * conta OAuth ao usuário/workspace.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          include: { workspace: { select: { id: true, name: true } } },
        });

        // Usuário inexistente, inativo, ou que só tem login social.
        if (!user || !user.isActive || !user.passwordHash) return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl,
          role: user.role,
          workspaceId: user.workspace.id,
          workspaceName: user.workspace.name,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // Primeiro login: copia os dados do usuário para o token.
      if (user) {
        token.id = user.id as string;
        token.role = user.role!;
        token.workspaceId = user.workspaceId!;
        token.workspaceName = user.workspaceName!;
      }

      // `update()` no client (ex.: usuário mudou o próprio nome).
      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.workspaceId = token.workspaceId;
        session.user.workspaceName = token.workspaceName;
      }
      return session;
    },
  },
});
