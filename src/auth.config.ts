import type { NextAuthConfig } from "next-auth";

/**
 * Configuração "edge-safe" do NextAuth.
 *
 * O middleware roda no Edge Runtime, onde Prisma e bcrypt não existem.
 * Por isso a config é dividida em duas: esta (sem providers pesados, usada
 * pelo middleware) e `src/auth.ts` (completa, usada pelo servidor Node).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  },
  trustHost: true,
  providers: [], // preenchidos em src/auth.ts
  callbacks: {
    /**
     * Guarda de rota central. Retornar false redireciona para `pages.signIn`.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

      if (isAuthPage) {
        // Já autenticado não deve ver login/registro.
        if (isLoggedIn) {
          return Response.redirect(new URL("/conversations", nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
