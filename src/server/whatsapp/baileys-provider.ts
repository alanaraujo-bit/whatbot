import type { WhatsappProviderKind } from "@prisma/client";

import type { ProviderSessionState, SendTextResult, WhatsAppProvider } from "./types";

/**
 * Provider Baileys.
 *
 * Baileys precisa de um socket WebSocket vivo e de estado em disco, o que não
 * sobrevive ao modelo de execução das rotas do Next. Por isso ele roda num
 * micro-serviço Node separado (`whatsapp-service/`) e esta classe é apenas o
 * cliente HTTP dele.
 */
export class BaileysProvider implements WhatsAppProvider {
  readonly kind: WhatsappProviderKind = "BAILEYS";

  private readonly baseUrl: string;
  private readonly token: string;

  constructor() {
    this.baseUrl = (process.env.WHATSAPP_SERVICE_URL ?? "http://localhost:4000").replace(/\/$/, "");
    this.token = process.env.WHATSAPP_SERVICE_TOKEN ?? "";
  }

  async connect(sessionId: string): Promise<ProviderSessionState> {
    return this.request<ProviderSessionState>(`/sessions/${sessionId}/connect`, { method: "POST" });
  }

  async getStatus(sessionId: string): Promise<ProviderSessionState> {
    return this.request<ProviderSessionState>(`/sessions/${sessionId}/status`);
  }

  async disconnect(sessionId: string): Promise<void> {
    await this.request(`/sessions/${sessionId}/disconnect`, { method: "POST" });
  }

  async logout(sessionId: string): Promise<void> {
    await this.request(`/sessions/${sessionId}/logout`, { method: "POST" });
  }

  async sendText(sessionId: string, to: string, text: string): Promise<SendTextResult> {
    return this.request<SendTextResult>(`/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ to, text }),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "x-service-token": this.token,
          ...init.headers,
        },
        cache: "no-store",
        // Sem timeout o dashboard trava caso o serviço esteja fora do ar.
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Serviço de WhatsApp indisponível em ${this.baseUrl}. ` +
          `Confirme que ele está rodando (npm run dev sobe os dois processos). Detalhe: ${reason}`
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Serviço de WhatsApp retornou ${response.status}: ${body || response.statusText}`);
    }

    return (await response.json()) as T;
  }
}
