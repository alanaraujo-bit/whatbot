import type { WhatsappProviderKind } from "@prisma/client";

import type { ProviderSessionState, SendTextResult, WhatsAppProvider } from "./types";

/**
 * Provider da WhatsApp Cloud API oficial (Meta) — ESQUELETO.
 *
 * Não faz parte do MVP. Existe para provar que a abstração `WhatsAppProvider`
 * comporta o modelo oficial, onde não há QR Code: o número já vem autorizado
 * pelo Business Manager e a sessão está sempre "conectada".
 *
 * Para ativar:
 *   1. Preencha META_PHONE_NUMBER_ID e META_ACCESS_TOKEN no .env
 *   2. Implemente `sendText` chamando POST /{phone-number-id}/messages
 *   3. Aponte o webhook da Meta para /api/whatsapp/webhook e traduza o
 *      payload deles para o tipo `WebhookEvent`
 *   4. Defina WHATSAPP_PROVIDER="cloud"
 */
export class CloudApiProvider implements WhatsAppProvider {
  readonly kind: WhatsappProviderKind = "CLOUD_API";

  private readonly phoneNumberId = process.env.META_PHONE_NUMBER_ID ?? "";
  private readonly accessToken = process.env.META_ACCESS_TOKEN ?? "";

  async connect(): Promise<ProviderSessionState> {
    this.assertConfigured();
    // Na API oficial não existe handshake: o número já está autorizado.
    return { status: "CONNECTED", phoneNumber: this.phoneNumberId };
  }

  async getStatus(): Promise<ProviderSessionState> {
    return this.phoneNumberId && this.accessToken
      ? { status: "CONNECTED", phoneNumber: this.phoneNumberId }
      : { status: "DISCONNECTED", error: "Credenciais da Meta não configuradas" };
  }

  async disconnect(): Promise<void> {
    // Sem operação: a autorização é gerenciada no Business Manager.
  }

  async logout(): Promise<void> {
    // Sem operação.
  }

  async sendText(_sessionId: string, to: string, text: string): Promise<SendTextResult> {
    this.assertConfigured();

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.split("@")[0],
          type: "text",
          text: { body: text },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Meta Cloud API retornou ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { messages?: Array<{ id: string }> };
    return { externalId: data.messages?.[0]?.id ?? null };
  }

  private assertConfigured() {
    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error(
        "Provider 'cloud' selecionado mas META_PHONE_NUMBER_ID/META_ACCESS_TOKEN não estão no .env"
      );
    }
  }
}
