"use client";

import { useEffect, useMemo, useRef } from "react";

import { MessageBubble } from "@/components/conversations/message-bubble";
import { dayKey, formatDayDivider } from "@/lib/format";
import type { MessageItem } from "@/types";

/**
 * Área de mensagens.
 *
 * Agrupa por dia e mantém o scroll colado no fim — mas só quando o usuário já
 * estava perto do fim. Se ele subiu para ler o histórico, uma mensagem nova
 * não deve arrastar a tela de volta.
 */
export function MessageList({ messages }: { messages: MessageItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  const groups = useMemo(() => {
    const map = new Map<string, MessageItem[]>();
    for (const message of messages) {
      const key = dayKey(message.timestamp);
      const bucket = map.get(key);
      if (bucket) bucket.push(message);
      else map.set(key, [message]);
    }
    return Array.from(map.entries());
  }, [messages]);

  // Registra a posição ANTES do DOM atualizar com as mensagens novas.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      wasAtBottomRef.current = distanceFromBottom < 120;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !wasAtBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="chat-canvas flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <p className="text-xs text-muted-foreground">
          Nenhuma mensagem ainda. Envie a primeira abaixo.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="chat-canvas min-h-0 flex-1 overflow-y-auto px-3 py-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-1">
        {groups.map(([day, dayMessages]) => (
          <div key={day} className="flex flex-col gap-1">
            <div className="sticky top-0 z-10 my-2 flex justify-center">
              <span className="rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                {formatDayDivider(dayMessages[0].timestamp)}
              </span>
            </div>

            {dayMessages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                // Mensagens seguidas do mesmo lado ficam mais juntas e sem "rabinho".
                isGrouped={
                  index > 0 && dayMessages[index - 1].direction === message.direction
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
