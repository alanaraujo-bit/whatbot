import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Middleware de proteção de rotas.
 *
 * Usa apenas a config edge-safe (sem Prisma/bcrypt). O callback `authorized`
 * em `auth.config.ts` decide quem passa.
 */
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: [
    /**
     * Protege tudo, exceto:
     *  - rotas de API do NextAuth e o webhook do WhatsApp (autenticado por token)
     *  - assets estáticos do Next
     *  - arquivos do PWA (manifest, service worker, ícones)
     */
    "/((?!api/auth|api/whatsapp/webhook|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|screenshots|offline.html).*)",
  ],
};
