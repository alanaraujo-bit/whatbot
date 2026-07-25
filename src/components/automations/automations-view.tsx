"use client";

import { useState } from "react";
import useSWR from "swr";
import { AlertTriangle, Bot, Pencil, Plus, Sparkles, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { AutomationDialog } from "@/components/automations/automation-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { AUTOMATION_TRIGGER_LABELS } from "@/lib/crm";
import { apiRequest, fetcher } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import type { AutomationItem } from "@/types";

export function AutomationsView() {
  const [editing, setEditing] = useState<AutomationItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading, mutate } = useSWR<{ automations: AutomationItem[] }>(
    "/api/automations",
    fetcher
  );

  const automations = data?.automations ?? [];

  async function toggleActive(automation: AutomationItem, isActive: boolean) {
    // Otimista: o switch responde na hora.
    mutate(
      {
        automations: automations.map((a) => (a.id === automation.id ? { ...a, isActive } : a)),
      },
      { revalidate: false }
    );

    try {
      await apiRequest(`/api/automations/${automation.id}`, {
        method: "PATCH",
        body: { isActive },
      });
      mutate();
    } catch (error) {
      toast.error((error as Error).message);
      mutate();
    }
  }

  async function remove(automation: AutomationItem) {
    if (!window.confirm(`Excluir a automação "${automation.name}"?`)) return;

    try {
      await apiRequest(`/api/automations/${automation.id}`, { method: "DELETE" });
      toast.success("Automação excluída");
      mutate();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Automações"
        description="Respostas automáticas para mensagens recebidas"
        actions={
          <Button size="sm" onClick={() => setIsCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nova automação</span>
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {/* Explicação da ordem de avaliação — sem isso o comportamento surpreende. */}
          <Card className="border-dashed bg-muted/30">
            <CardContent className="flex items-start gap-2.5 p-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Como as regras são avaliadas</p>
                <p>
                  As automações são testadas da <strong>menor para a maior prioridade</strong> e
                  apenas a <strong>primeira que casar</strong> dispara — o cliente nunca recebe
                  duas respostas automáticas para a mesma mensagem.
                </p>
              </div>
            </CardContent>
          </Card>

          {isLoading && !data ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : automations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
              <Bot className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Nenhuma automação criada</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Crie regras para responder perguntas frequentes automaticamente, como preço,
                horário de atendimento ou boas-vindas.
              </p>
              <Button size="sm" variant="outline" onClick={() => setIsCreating(true)} className="mt-1">
                <Plus className="h-3.5 w-3.5" />
                Criar primeira automação
              </Button>
            </div>
          ) : (
            automations.map((automation) => (
              <Card key={automation.id}>
                <CardContent className="space-y-2.5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">{automation.name}</h3>
                        <Badge variant="muted">Prioridade {automation.priority}</Badge>
                        {automation.onlyFirstMessage && (
                          <Badge variant="outline">Só na 1ª mensagem</Badge>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Quando a mensagem{" "}
                        <span className="font-medium text-foreground">
                          {AUTOMATION_TRIGGER_LABELS[automation.trigger].toLowerCase()}
                        </span>
                        {automation.trigger !== "ANY_MESSAGE" && (
                          <>
                            {" "}
                            <span className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
                              {automation.keyword}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Switch
                        checked={automation.isActive}
                        onCheckedChange={(checked) => toggleActive(automation, checked)}
                        aria-label={automation.isActive ? "Desativar" : "Ativar"}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing(automation)}
                        aria-label="Editar automação"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(automation)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Excluir automação"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-muted/40 p-2">
                    <p className="whitespace-pre-wrap break-words text-xs">
                      {automation.response}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {automation.triggerCount} disparo(s)
                    </span>
                    {automation.lastTriggeredAt && (
                      <span>Último: {formatDateTime(automation.lastTriggeredAt)}</span>
                    )}
                    {!automation.isActive && (
                      <span className="font-medium text-amber-600 dark:text-amber-500">
                        Desativada
                      </span>
                    )}
                  </div>

                  {/*
                    Regra ativa que nunca disparou costuma ser regra mal
                    configurada, não regra sem demanda. Empurra para o teste.
                  */}
                  {automation.isActive && automation.triggerCount === 0 && (
                    <button
                      onClick={() => setEditing(automation)}
                      className="flex w-full items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-left transition-colors hover:bg-amber-500/20"
                    >
                      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
                      <span className="text-[11px] text-amber-700 dark:text-amber-400">
                        Esta regra nunca disparou. Clique para abrir e testar com uma
                        mensagem de exemplo.
                      </span>
                    </button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <AutomationDialog
        open={isCreating || editing !== null}
        automation={editing}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditing(null);
          }
        }}
        onSaved={() => mutate()}
      />
    </div>
  );
}
