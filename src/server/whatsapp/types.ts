import type { SessionStatus, WhatsappProviderKind } from "@prisma/client";

/**
 * Contrato de integração com o WhatsApp.
 *
 * Toda a aplicação fala com o WhatsApp APENAS através desta interface.
 * Trocar Baileys pela Cloud API oficial da Meta é escrever uma nova
 * implementação e mudar a env `WHATSAPP_PROVIDER` — nenhum outro arquivo muda.
 */

export type ProviderSessionState = {
  status: SessionStatus;
  /** Data URL do QR Code (apenas quando status = QR_PENDING). */
  qrCode?: string | null;
  phoneNumber?: string | null;
  profileName?: string | null;
  error?: string | null;
};

export type SendTextResult = {
  /** ID da mensagem no WhatsApp, usado para deduplicação e status de entrega. */
  externalId: string | null;
};

export interface WhatsAppProvider {
  readonly kind: WhatsappProviderKind;

  /**
   * Inicia a sessão. Para Baileys dispara a geração do QR Code; o resultado
   * final chega de forma assíncrona pelo webhook.
   */
  connect(sessionId: string): Promise<ProviderSessionState>;

  /** Estado atual da sessão, consultado sob demanda. */
  getStatus(sessionId: string): Promise<ProviderSessionState>;

  /** Encerra o socket mas preserva as credenciais (reconecta sem novo QR). */
  disconnect(sessionId: string): Promise<void>;

  /** Encerra e apaga as credenciais — o próximo connect exige novo QR. */
  logout(sessionId: string): Promise<void>;

  /** Envia mensagem de texto. `to` é um JID ("5511...@s.whatsapp.net"). */
  sendText(sessionId: string, to: string, text: string): Promise<SendTextResult>;
}

/** Payloads que o micro-serviço entrega no webhook do Next.js. */
export type WebhookEvent =
  | {
      type: "status";
      sessionId: string;
      status: SessionStatus;
      qrCode?: string | null;
      phoneNumber?: string | null;
      profileName?: string | null;
      error?: string | null;
    }
  | {
      type: "message";
      sessionId: string;
      message: {
        externalId: string;
        /** JID do remetente. */
        from: string;
        /** Nome do perfil no WhatsApp, quando disponível. */
        pushName?: string | null;
        text: string;
        /** Epoch em segundos. */
        timestamp: number;
        mediaType?: string | null;
        /** True quando a mensagem foi enviada pelo próprio número (outro device). */
        fromMe?: boolean;
      };
    }
  | {
      type: "message-status";
      sessionId: string;
      externalId: string;
      status: "DELIVERED" | "READ" | "FAILED";
    };
