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
     * O middleware guarda apenas PÁGINAS.
     *
     * `/api/*` fica inteiramente de fora: cada rota já se protege sozinha
     * (`requireAuth()`, token de serviço no webhook, ou pública por design como
     * o cadastro). Deixar o middleware na frente delas causava dois problemas:
     *
     *  1. `/api/register` era redirecionado para /login, quebrando o cadastro —
     *     o POST caía em /login, que não aceita POST, e devolvia HTTP 405.
     *  2. Um XHR sem sessão recebia um redirect para HTML em vez de 401 JSON,
     *     que é o que o cliente sabe tratar.
     *
     * Também exclui assets do Next e os arquivos do PWA.
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|screenshots/|offline.html).*)",
  ],
};
