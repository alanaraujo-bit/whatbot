"use client";

import { useEffect, useRef } from "react";

export type RealtimeEvent =
  | { type: "message:new"; workspaceId: string; conversationId: string }
  | { type: "conversation:updated"; workspaceId: string; conversationId: string }
  | { type: "session:updated"; workspaceId: string; sessionId: string };

/**
 * Assina o stream SSE de `/api/events`.
 *
 * O `EventSource` reconecta sozinho quando a conexão cai, então não há lógica
 * de retry aqui. O handler fica numa ref para que mudanças de closure não
 * derrubem e recriem a conexão a cada render.
 */
export function useRealtime(onEvent: (event: RealtimeEvent) => void): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource("/api/events");

    const handle = (raw: MessageEvent) => {
      try {
        handlerRef.current(JSON.parse(raw.data) as RealtimeEvent);
      } catch {
        // Heartbeat ou payload malformado: ignorar.
      }
    };

    for (const type of ["message:new", "conversation:updated", "session:updated"]) {
      source.addEventListener(type, handle as EventListener);
    }

    source.onerror = () => {
      // O browser já agenda a reconexão; logar aqui só polui o console.
    };

    return () => source.close();
  }, []);
}
