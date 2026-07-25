"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { AlertCircle, Loader2 } from "lucide-react";

import { ChatHeader } from "@/components/conversations/chat-header";
import { ContactPanel } from "@/components/conversations/contact-panel";
import { MessageComposer } from "@/components/conversations/message-composer";
import { MessageList } from "@/components/conversations/message-list";
import { useRealtime } from "@/hooks/use-realtime";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import type { ConversationDetail } from "@/types";

/**
 * Colunas 2 e 3 do módulo de conversas.
 *
 * Um único fetch traz conversa + mensagens + contato + notas: o painel da
 * direita não precisa de request próprio, e tudo revalida junto quando chega
 * um evento em tempo real.
 */
export function ConversationView({ conversationId }: { conversationId: string }) {
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<{ conversation: ConversationDetail }>(
    `/api/conversations/${conversationId}`,
    fetcher,
    {
      revalidateOnFocus: true,
      keepPreviousData: true,
      // Conversa aberta atualiza mais rápido que a lista — ver `conversation-list`
      // para o porquê de o polling ser o caminho principal em serverless.
      refreshInterval: 3000,
    }
  );

  useRealtime(
    useCallback(
      (event) => {
        // Só revalida se o evento for desta conversa.
        if (
          (event.type === "message:new" || event.type === "conversation:updated") &&
          event.conversationId === conversationId
        ) {
          mutate();
        }
      },
      [conversationId, mutate]
    )
  );

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium">Não foi possível carregar a conversa</p>
        <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const conversation = data!.conversation;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          conversation={conversation}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((v) => !v)}
          onChanged={() => mutate()}
        />

        <MessageList messages={conversation.messages} />

        <MessageComposer
          conversationId={conversation.id}
          contactName={conversation.contact.name}
          onSent={() => mutate()}
        />
      </div>

      {/*
        Coluna 3: sempre visível em telas largas, alternável no meio-termo,
        e sobreposta em tela cheia no mobile.
      */}
      <aside
        className={cn(
          "w-full shrink-0 border-l border-border bg-background lg:w-[300px]",
          "absolute inset-0 z-30 lg:static lg:z-auto",
          panelOpen ? "block" : "hidden lg:block"
        )}
      >
        <ContactPanel
          contact={conversation.contact}
          conversationId={conversation.id}
          onClose={() => setPanelOpen(false)}
          onChanged={() => mutate()}
        />
      </aside>
    </div>
  );
}
