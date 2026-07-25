import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

import { auth } from "@/auth";

/**
 * Helpers compartilhados por todas as API routes.
 * Padroniza autenticação, escopo de workspace e formato de erro.
 */

export type AuthContext = {
  userId: string;
  workspaceId: string;
  role: string;
  name: string;
};

/** Erro de negócio com status HTTP. Capturado por `handle()`. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Garante que há sessão válida e devolve o contexto multi-tenant.
 * Lança ApiError 401 quando não autenticado.
 */
export async function requireAuth(): Promise<AuthContext> {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) {
    throw new ApiError("Não autenticado", 401);
  }
  return {
    userId: session.user.id,
    workspaceId: session.user.workspaceId,
    role: session.user.role,
    name: session.user.name ?? "",
  };
}

/** Valida o corpo JSON da requisição contra um schema Zod. */
export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("Corpo da requisição inválido (JSON malformado)");
  }
  return schema.parse(raw);
}

/**
 * Envelopa um handler de rota, convertendo exceções em respostas JSON
 * consistentes. Evita repetir try/catch em cada endpoint.
 */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data ?? { ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Dados inválidos",
          // Achata os issues do Zod em { campo: "mensagem" } para o formulário.
          fields: Object.fromEntries(
            error.errors.map((e) => [e.path.join(".") || "_", e.message])
          ),
        },
        { status: 422 }
      );
    }

    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[api] erro não tratado:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
