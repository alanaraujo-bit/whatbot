"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { MessageSquare, MoreHorizontal, Pencil, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { ContactDialog } from "@/components/contacts/contact-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CRM_STAGES, stageMeta } from "@/lib/crm";
import { apiRequest, fetcher } from "@/lib/fetcher";
import { formatPhone } from "@/lib/phone";
import { cn, getInitials, readableTextColor, stringToColor } from "@/lib/utils";
import type { ContactListItem, TagWithCount } from "@/types";

export function ContactsView() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("ALL");
  const [editing, setEditing] = useState<ContactListItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    if (stage !== "ALL") qs.set("stage", stage);
    return qs.toString();
  }, [search, stage]);

  const { data, isLoading, mutate } = useSWR<{ contacts: ContactListItem[] }>(
    `/api/contacts${query ? `?${query}` : ""}`,
    fetcher,
    { keepPreviousData: true }
  );

  const { data: tagsData, mutate: mutateTags } = useSWR<{ tags: TagWithCount[] }>(
    "/api/tags",
    fetcher
  );

  const contacts = data?.contacts ?? [];

  async function remove(contact: ContactListItem) {
    const confirmed = window.confirm(
      `Excluir "${contact.name}"?\n\nAs conversas e notas deste contato também serão removidas. Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    try {
      await apiRequest(`/api/contacts/${contact.id}`, { method: "DELETE" });
      toast.success("Contato excluído");
      mutate();
      mutateTags();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Contatos"
        description={`${contacts.length} contato(s)`}
        actions={
          <Button size="sm" onClick={() => setIsCreating(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Novo contato</span>
          </Button>
        }
      />

      <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row md:px-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, e-mail ou empresa"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="h-8 w-full text-xs sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">
              Todas as etapas
            </SelectItem>
            {CRM_STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && !data ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium">Nenhum contato encontrado</p>
            <p className="text-xs text-muted-foreground">
              Contatos são criados automaticamente quando alguém manda mensagem, ou
              você pode cadastrar manualmente.
            </p>
            <Button size="sm" variant="outline" onClick={() => setIsCreating(true)} className="mt-1">
              <Plus className="h-3.5 w-3.5" />
              Cadastrar contato
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {contacts.map((contact) => {
              const meta = stageMeta(contact.stage);
              const conversationId = contact.conversations[0]?.id;

              return (
                <li
                  key={contact.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40 md:px-4",
                    highlightId === contact.id && "bg-primary/5"
                  )}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback
                      style={{
                        backgroundColor: stringToColor(contact.name),
                        color: readableTextColor(stringToColor(contact.name)),
                      }}
                    >
                      {getInitials(contact.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{contact.name}</span>
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                      <span className={cn("hidden shrink-0 text-2xs sm:inline", meta.accent)}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{formatPhone(contact.phone)}</span>
                      {contact.email && (
                        <span className="hidden truncate md:inline">· {contact.email}</span>
                      )}
                    </div>

                    {contact.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {contact.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded px-1.5 py-px text-[10px] font-medium"
                            style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {conversationId && (
                      <Button variant="ghost" size="icon-sm" asChild aria-label="Abrir conversa">
                        <Link href={`/conversations/${conversationId}`}>
                          <MessageSquare className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Ações do contato">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(contact)}>
                          <Pencil className="h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => remove(contact)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ContactDialog
        open={isCreating || editing !== null}
        contact={editing}
        allTags={tagsData?.tags ?? []}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditing(null);
          }
        }}
        onSaved={() => {
          mutate();
          mutateTags();
        }}
      />
    </div>
  );
}
