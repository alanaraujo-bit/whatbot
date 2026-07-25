import { format, isThisYear, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Horário na lista de conversas: hoje mostra a hora, ontem mostra "Ontem",
 * esta semana o dia, e o resto a data curta. Mesmo padrão do WhatsApp.
 */
export function formatConversationTime(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;

  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  if (isThisYear(d)) return format(d, "dd/MM");
  return format(d, "dd/MM/yy");
}

/** Hora exibida dentro da bolha da mensagem. */
export function formatMessageTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "HH:mm");
}

/** Cabeçalho de separação por dia dentro do chat. */
export function formatDayDivider(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  if (isThisYear(d)) return format(d, "d 'de' MMMM", { locale: ptBR });
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/** Data + hora por extenso, para notas e tooltips. */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/** Chave de agrupamento por dia (YYYY-MM-DD). */
export function dayKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "yyyy-MM-dd");
}
