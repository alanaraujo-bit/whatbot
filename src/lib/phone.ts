/**
 * Utilitários de telefone.
 *
 * O WhatsApp identifica contatos por JID: "<numero>@s.whatsapp.net".
 * Internamente guardamos sempre só os dígitos em formato internacional.
 */

/** Remove tudo que não for dígito. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Garante DDI brasileiro quando o usuário digita só DDD + número.
 * 11988887777 (11 dígitos) -> 5511988887777
 */
export function toInternational(input: string, defaultCountryCode = "55"): string {
  const digits = normalizePhone(input);
  if (!digits) return "";
  // 10 ou 11 dígitos = número nacional brasileiro sem DDI.
  if (digits.length <= 11 && !digits.startsWith(defaultCountryCode)) {
    return defaultCountryCode + digits;
  }
  return digits;
}

/** Converte um número em JID do WhatsApp. */
export function phoneToJid(phone: string): string {
  return `${toInternational(phone)}@s.whatsapp.net`;
}

/** Extrai o número de um JID, descartando sufixo de device (":12"). */
export function jidToPhone(jid: string): string {
  return normalizePhone(jid.split("@")[0].split(":")[0]);
}

/** True para grupos e broadcasts — o MVP ignora esses chats. */
export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us") || jid.endsWith("@broadcast") || jid === "status@broadcast";
}

/**
 * Formata para leitura. Brasileiro vira +55 (11) 98888-7777;
 * outros DDIs caem num formato genérico com "+".
 */
export function formatPhone(phone: string): string {
  const d = normalizePhone(phone);
  if (d.startsWith("55") && (d.length === 13 || d.length === 12)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    const mid = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const end = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `+55 (${ddd}) ${mid}-${end}`;
  }
  return d ? `+${d}` : "";
}
