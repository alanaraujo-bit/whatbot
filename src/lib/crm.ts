import type { CrmStage } from "@prisma/client";

/**
 * Metadados das etapas do pipeline.
 *
 * Fonte única de verdade para rótulo, cor e ordem — usada no board do CRM,
 * nos filtros e no painel do contato.
 */
export const CRM_STAGES: Array<{
  value: CrmStage;
  label: string;
  /** Classe Tailwind do ponto colorido / cabeçalho da coluna. */
  dot: string;
  accent: string;
}> = [
  { value: "NEW_LEAD", label: "Novo lead", dot: "bg-sky-500", accent: "text-sky-600 dark:text-sky-400" },
  {
    value: "CONTACTED",
    label: "Contato realizado",
    dot: "bg-violet-500",
    accent: "text-violet-600 dark:text-violet-400",
  },
  {
    value: "NEGOTIATION",
    label: "Negociação",
    dot: "bg-amber-500",
    accent: "text-amber-600 dark:text-amber-400",
  },
  {
    value: "WON",
    label: "Venda concluída",
    dot: "bg-emerald-500",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  { value: "LOST", label: "Perdido", dot: "bg-rose-500", accent: "text-rose-600 dark:text-rose-400" },
];

export function stageMeta(stage: CrmStage) {
  return CRM_STAGES.find((s) => s.value === stage) ?? CRM_STAGES[0];
}

export const CONVERSATION_STATUS_LABELS = {
  OPEN: "Aberta",
  PENDING: "Aguardando",
  CLOSED: "Finalizada",
} as const;

export const AUTOMATION_TRIGGER_LABELS = {
  CONTAINS: "Contém",
  EQUALS: "É exatamente",
  STARTS_WITH: "Começa com",
  ANY_MESSAGE: "Qualquer mensagem",
} as const;
