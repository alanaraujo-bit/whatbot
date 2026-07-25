"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { CrmCard } from "@/components/crm/crm-card";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CRM_STAGES } from "@/lib/crm";
import { apiRequest, fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import type { ContactListItem } from "@/types";
import type { CrmStage } from "@prisma/client";

/**
 * Board do pipeline.
 *
 * Drag & drop usa a HTML5 Drag and Drop API nativa — sem dependência extra.
 * No mobile, onde o drag nativo não funciona bem, o card oferece um seletor
 * de etapa; assim a funcionalidade nunca fica inacessível.
 */
export function CrmBoard() {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<CrmStage | null>(null);

  const { data, isLoading, mutate } = useSWR<{ contacts: ContactListItem[] }>(
    "/api/contacts",
    fetcher,
    { keepPreviousData: true }
  );

  const contacts = useMemo(() => data?.contacts ?? [], [data]);

  const byStage = useMemo(() => {
    const map = new Map<CrmStage, ContactListItem[]>();
    for (const stage of CRM_STAGES) map.set(stage.value, []);
    for (const contact of contacts) {
      map.get(contact.stage)?.push(contact);
    }
    return map;
  }, [contacts]);

  async function moveToStage(contactId: string, stage: CrmStage) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact || contact.stage === stage) return;

    // Atualização otimista: o card se move na hora, sem esperar o servidor.
    mutate(
      { contacts: contacts.map((c) => (c.id === contactId ? { ...c, stage } : c)) },
      { revalidate: false }
    );

    try {
      await apiRequest(`/api/contacts/${contactId}`, { method: "PATCH", body: { stage } });
      mutate();
    } catch (error) {
      toast.error((error as Error).message);
      mutate(); // desfaz revertendo ao estado do servidor
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="CRM"
        description="Arraste os contatos entre as etapas do funil"
        actions={
          isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null
        }
      />

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3 md:p-4">
        <div className="flex h-full min-h-0 gap-3">
          {CRM_STAGES.map((stage) => {
            const stageContacts = byStage.get(stage.value) ?? [];
            const isDropTarget = dragOverStage === stage.value;

            return (
              <section
                key={stage.value}
                onDragOver={(e) => {
                  // preventDefault é o que autoriza o drop nesta área.
                  e.preventDefault();
                  setDragOverStage(stage.value);
                }}
                onDragLeave={() => setDragOverStage((s) => (s === stage.value ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStage(null);
                  const contactId = e.dataTransfer.getData("text/plain") || draggingId;
                  if (contactId) moveToStage(contactId, stage.value);
                }}
                className={cn(
                  "flex h-full w-[248px] shrink-0 flex-col rounded-lg border border-border bg-muted/30 transition-colors",
                  isDropTarget && "border-primary bg-primary/5"
                )}
              >
                <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", stage.dot)} />
                    <h2 className="text-xs font-semibold">{stage.label}</h2>
                  </div>
                  <span className="rounded bg-background px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                    {stageContacts.length}
                  </span>
                </header>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                  {isLoading && !data ? (
                    <>
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </>
                  ) : stageContacts.length === 0 ? (
                    <p className="px-1 py-4 text-center text-[11px] text-muted-foreground">
                      Nenhum contato nesta etapa
                    </p>
                  ) : (
                    stageContacts.map((contact) => (
                      <CrmCard
                        key={contact.id}
                        contact={contact}
                        isDragging={draggingId === contact.id}
                        onDragStart={(e) => {
                          setDraggingId(contact.id);
                          e.dataTransfer.setData("text/plain", contact.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverStage(null);
                        }}
                        onStageChange={(newStage) => moveToStage(contact.id, newStage)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
