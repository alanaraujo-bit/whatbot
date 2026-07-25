import bcrypt from "bcryptjs";

import { ApiError, handle, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";

/**
 * Cadastro público.
 *
 * Cria Workspace + usuário OWNER numa transação e já semeia as etiquetas
 * padrão, para o CRM não abrir vazio.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const data = await parseBody(request, registerSchema);
    const email = data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError("Já existe uma conta com este e-mail", 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const slug = await generateUniqueSlug(data.workspaceName);

    await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: data.workspaceName.trim(), slug },
      });

      await tx.user.create({
        data: {
          name: data.name.trim(),
          email,
          passwordHash,
          role: "OWNER",
          workspaceId: workspace.id,
        },
      });

      await tx.whatsappSession.create({
        data: { name: "Número principal", workspaceId: workspace.id },
      });

      await tx.tag.createMany({
        data: [
          { name: "Novo cliente", color: "#22c55e", workspaceId: workspace.id },
          { name: "Orçamento", color: "#3b82f6", workspaceId: workspace.id },
          { name: "Pagamento pendente", color: "#f59e0b", workspaceId: workspace.id },
          { name: "Cliente VIP", color: "#a855f7", workspaceId: workspace.id },
        ],
      });

      /**
       * Automações iniciais, criadas DESATIVADAS.
       *
       * Uma conta nova começando com a tela de automações vazia levava o
       * usuário a montar a primeira regra do zero, sem referência — e a errar
       * a combinação de gatilho. Exemplos prontos servem de modelo; ele revisa
       * o texto e liga quando quiser.
       */
      await tx.automation.createMany({
        data: [
          {
            workspaceId: workspace.id,
            name: "Boas-vindas",
            trigger: "ANY_MESSAGE",
            keyword: null,
            response:
              "Olá! 👋 Recebemos sua mensagem e um atendente responderá em instantes.",
            priority: 99,
            onlyFirstMessage: true,
            isActive: false,
          },
          {
            workspaceId: workspace.id,
            name: "Perguntas sobre preço",
            trigger: "CONTAINS",
            keyword: "preço",
            response: "Olá! Vou te ajudar com informações sobre nossos preços. 💰",
            priority: 0,
            isActive: false,
          },
          {
            workspaceId: workspace.id,
            name: "Formas de pagamento",
            trigger: "CONTAINS",
            keyword: "pix",
            response: "Sim, aceitamos Pix! Posso te passar a chave agora.",
            priority: 1,
            isActive: false,
          },
        ],
      });
    });

    return { ok: true };
  });
}

/** Gera um slug único acrescentando sufixo numérico quando colide. */
async function generateUniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace";

  let candidate = base;
  let n = 1;
  while (await prisma.workspace.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}
