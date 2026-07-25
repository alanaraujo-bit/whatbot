import { BaileysProvider } from "./baileys-provider";
import { CloudApiProvider } from "./cloud-provider";
import type { WhatsAppProvider } from "./types";

export type { WhatsAppProvider, ProviderSessionState, WebhookEvent } from "./types";

let cached: WhatsAppProvider | null = null;

/**
 * Fábrica do provider ativo, escolhido por `WHATSAPP_PROVIDER`.
 * Único ponto do código que decide qual implementação usar.
 */
export function getWhatsAppProvider(): WhatsAppProvider {
  if (cached) return cached;

  const kind = (process.env.WHATSAPP_PROVIDER ?? "baileys").toLowerCase();
  cached = kind === "cloud" ? new CloudApiProvider() : new BaileysProvider();

  return cached;
}
