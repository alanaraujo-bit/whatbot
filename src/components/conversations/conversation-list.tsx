"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Loader2, Search, X } from "lucide-react";

import { ConversationListItemRow } from "@/components/conversations/conversation-list-item";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtime } from "@/hooks/use-realtime";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import type { ConversationListItem } from "@/types";

const FILTERS = [
  { value: "ALL", label: "Todas" },
  { value: "OPEN", label: "Abertas" },
  { value: "CLOSED", label: "Finalizadas" },
] as const;

export function ConversationList() {
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number]["value"]>("ALL");

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    if (status !== "ALL") qs.set("status", status);
    return qs.toString();
  }, [search, status]);

  const { data, isLoading, mutate } = useSWR<{ conversations: ConversationListItem[] }>(
    `/api/conversations${query ? `?${query}` : ""}`,
    fetcher,
    {
      revalidateOnFocus: true,
      keepPreviousData: true,
      /**
       * Polling é o caminho PRINCIPAL de atualização em produção.
       *
       * O SSE abaixo depende de um barramento em processo, que só funciona
       * quando o app roda como processo único (dev/self-host). Em serverless
       * (Vercel) o webhook chega numa instância e o stream vive em outra, então
       * o evento nunca cruza — o polling garante que a lista atualize de todo
       * jeito. Quando o SSE funciona, ele apenas antecipa o refresh.
       */
      refreshInterval: 5000,
    }
  );

  useRealtime(
    useCallback(
      (event) => {
        if (event.type === "conversation:updated" || event.type === "message:new") {
          mutate();
        }
      },
      [mutate]
    )
  );

  const conversations = data?.conversations ?? [];
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 space-y-3 border-b border-border px-3 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold tracking-tight">
            Conversas
            {totalUnread > 0 && (
              <Badge className="ml-2 px-1.5 py-0">{totalUnread}</Badge>
            )}
          </h1>
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="h-8 pl-8 pr-8 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatus(filter.value)}
              className={cn(
                "rounded-md px-2 py-1 text-2xs font-medium transition-colors",
                status === filter.value
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent/60"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && !data ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg p-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState hasFilters={Boolean(search || status !== "ALL")} />
        ) : (
          <ul className="p-1.5">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link href={`/conversations/${conversation.id}`}>
                  <ConversationListItemRow
                    conversation={conversation}
                    isActive={conversation.id === activeId}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm font-medium">
        {hasFilters ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
      </p>
      <p className="text-xs text-muted-foreground">
        {hasFilters
          ? "Tente outro termo ou remova os filtros."
          : "Conecte um WhatsApp em Configurações para começar a receber mensagens."}
      </p>
    </div>
  );
}
