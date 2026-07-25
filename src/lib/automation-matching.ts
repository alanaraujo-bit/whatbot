/**
 * Lógica de casamento de automações — compartilhada entre cliente e servidor.
 *
 * O testador da interface PRECISA usar exatamente as mesmas regras do motor
 * em `src/server/automations.ts`. Duplicar a lógica faria o preview mentir
 * para o usuário, que é justamente o problema que o testador existe para
 * resolver.
 */

export type TriggerKind = "CONTAINS" | "EQUALS" | "STARTS_WITH" | "ANY_MESSAGE";

/** Minúsculas e sem acentos: "Preço" e "preco" casam igual. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function matchesTrigger(
  trigger: TriggerKind,
  keyword: string | null | undefined,
  message: string
): boolean {
  if (trigger === "ANY_MESSAGE") return true;

  const needle = normalizeForMatch(keyword ?? "");
  if (!needle) return false;

  const haystack = normalizeForMatch(message);

  switch (trigger) {
    case "CONTAINS":
      return haystack.includes(needle);
    case "EQUALS":
      return haystack === needle;
    case "STARTS_WITH":
      return haystack.startsWith(needle);
    default:
      return false;
  }
}

/**
 * Detecta configurações que quase nunca disparam, para avisar antes de salvar.
 *
 * Motivação real: uma regra criada como `EQUALS "pix"` + "só na primeira
 * mensagem" só dispara se a primeiríssima mensagem do cliente for exatamente
 * "pix" — nada mais. Ficou semanas sem disparar sem que ninguém entendesse.
 */
export function describeRestrictiveness(
  trigger: TriggerKind,
  onlyFirstMessage: boolean
): string | null {
  if (trigger === "EQUALS" && onlyFirstMessage) {
    return "Combinação muito restritiva: só dispara se a PRIMEIRA mensagem do cliente for exatamente a palavra-chave, sem mais nada. Considere usar “Contém”.";
  }
  if (trigger === "EQUALS") {
    return "“É exatamente” exige que a mensagem inteira seja a palavra-chave. “Olá, aceita pix?” não casa com “pix”. Na dúvida, use “Contém”.";
  }
  if (trigger === "ANY_MESSAGE" && !onlyFirstMessage) {
    return "Isto responde a TODA mensagem recebida, o tempo todo. Normalmente você quer marcar “apenas na primeira mensagem”.";
  }
  return null;
}
