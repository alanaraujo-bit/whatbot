import { EventEmitter } from "node:events";

/**
 * Barramento de eventos em processo, consumido pelo endpoint SSE (`/api/events`).
 *
 * Por que não Redis/Socket.IO: no MVP o Next roda como um único processo, então
 * um EventEmitter resolve tempo real sem infraestrutura extra. Ao escalar para
 * múltiplas instâncias, troque a implementação de `publish`/`subscribe` por um
 * Redis pub/sub — a assinatura das funções não muda.
 */

export type AppEvent =
  /** Mensagem nova (entrada ou saída) numa conversa. */
  | { type: "message:new"; workspaceId: string; conversationId: string }
  /** Metadados da conversa mudaram (última mensagem, não lidas, status). */
  | { type: "conversation:updated"; workspaceId: string; conversationId: string }
  /** Status da conexão do WhatsApp mudou (QR, conectado, caiu). */
  | { type: "session:updated"; workspaceId: string; sessionId: string };

const globalForEvents = globalThis as unknown as { wapplyBus: EventEmitter | undefined };

const bus =
  globalForEvents.wapplyBus ??
  (() => {
    const emitter = new EventEmitter();
    // Cada aba aberta é um listener; o default de 10 estoura rápido.
    emitter.setMaxListeners(0);
    return emitter;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.wapplyBus = bus;
}

/** Canal por workspace — garante isolamento entre tenants. */
function channel(workspaceId: string) {
  return `ws:${workspaceId}`;
}

export function publish(event: AppEvent): void {
  bus.emit(channel(event.workspaceId), event);
}

/** Inscreve um listener. Retorna a função de cancelamento. */
export function subscribe(workspaceId: string, listener: (event: AppEvent) => void): () => void {
  const name = channel(workspaceId);
  bus.on(name, listener);
  return () => {
    bus.off(name, listener);
  };
}
