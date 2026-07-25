import { z } from "zod";

/**
 * Schemas Zod compartilhados entre formulários (client) e API routes (server).
 * A validação do servidor é a que vale — a do cliente é só UX.
 */

// --- Autenticação -----------------------------------------------------

export const loginSchema = z.object({
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().min(2, "Nome muito curto").max(80),
    email: z.string().email("E-mail inválido"),
    workspaceName: z.string().min(2, "Informe o nome da empresa").max(80),
    password: z.string().min(8, "A senha precisa de ao menos 8 caracteres").max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

// --- Contatos ---------------------------------------------------------

export const crmStageSchema = z.enum(["NEW_LEAD", "CONTACTED", "NEGOTIATION", "WON", "LOST"]);

export const contactSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(120),
  phone: z
    .string()
    .min(8, "Telefone inválido")
    .max(20)
    .regex(/^[\d\s()+-]+$/, "Use apenas números e símbolos de telefone"),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]).optional(),
  company: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  stage: crmStageSchema.optional(),
  tagIds: z.array(z.string()).optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const updateStageSchema = z.object({
  stage: crmStageSchema,
});

// --- Tags -------------------------------------------------------------

export const tagSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
    .default("#6366f1"),
});
export type TagInput = z.infer<typeof tagSchema>;

// --- Mensagens --------------------------------------------------------

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1, "Mensagem vazia").max(4096),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// --- Notas ------------------------------------------------------------

export const noteSchema = z.object({
  body: z.string().min(1, "Nota vazia").max(2000),
});
export type NoteInput = z.infer<typeof noteSchema>;

// --- Automações -------------------------------------------------------

export const automationTriggerSchema = z.enum([
  "CONTAINS",
  "EQUALS",
  "STARTS_WITH",
  "ANY_MESSAGE",
]);

export const automationSchema = z
  .object({
    name: z.string().min(1, "Informe o nome").max(80),
    trigger: automationTriggerSchema,
    keyword: z.string().max(80).optional(),
    response: z.string().min(1, "Informe a resposta").max(4096),
    isActive: z.boolean().optional(),
    priority: z.number().int().min(0).max(999).optional(),
    onlyFirstMessage: z.boolean().optional(),
  })
  .refine((d) => d.trigger === "ANY_MESSAGE" || !!d.keyword?.trim(), {
    message: "Informe a palavra-chave do gatilho",
    path: ["keyword"],
  });
export type AutomationInput = z.infer<typeof automationSchema>;

// --- Perfil -----------------------------------------------------------

export const profileSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(80),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z.string().min(8, "A nova senha precisa de ao menos 8 caracteres").max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });
