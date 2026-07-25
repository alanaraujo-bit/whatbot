"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { apiRequest } from "@/lib/fetcher";
import type { MessageItem } from "@/types";

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

  /**
   * Envio otimista.
   *
   * A mensagem entra no cache do SWR ANTES da requisição, então aparece no
   * chat instantaneamente. Sem isso o atendente esperava o round-trip até o
   * WhatsApp mais um refetch da conversa inteira — segundos de silêncio depois
   * de apertar Enter, que era a queixa principal de lentidão.
   */
  async function sendMessage(content: string) {
    const optimistic: MessageItem = {
      // O id temporário é substituído pela resposta do servidor.
      id: `temp-${Date.now()}`,
      workspaceId: conversation.workspaceId,
      conversationId: conversation.id,
      externalId: null,
      direction: "OUTBOUND",
      type: "TEXT",
      content,
      mediaUrl: null,
      mediaMime: null,
      status: "PENDING",
      isAutomated: false,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      sentById: null,
      sentBy: null,
    };

    const withOptimistic = {
      conversation: { ...conversation, messages: [...conversation.messages, optimistic] },
    };

    try {
      await mutate(
        async () => {
          const res = await apiRequest<{ message: MessageItem }>("/api/messages", {
            method: "POST",
            body: { conversationId: conversation.id, content },
          });
          // Troca a temporária pela definitiva, preservando a ordem.
          return {
            conversation: {
              ...conversation,
              messages: [...conversation.messages, res.message],
            },
          };
        },
        { optimisticData: withOptimistic, rollbackOnError: true, revalidate: true }
      );
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
  }

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

        <MessageComposer contactName={conversation.contact.name} onSend={sendMessage} />
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
