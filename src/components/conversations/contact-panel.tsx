"use client";

import { useState } from "react";
import useSWR from "swr";
import { Building2, Mail, Phone, Plus, StickyNote, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { TagPicker } from "@/components/contacts/tag-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CRM_STAGES } from "@/lib/crm";
import { apiRequest, fetcher } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { getInitials, readableTextColor, stringToColor } from "@/lib/utils";
import type { ConversationDetail, TagWithCount } from "@/types";

/**
 * Coluna 3 — ficha do cliente.
 *
 * Tudo aqui é edição inline: etapa do funil, etiquetas e notas internas
 * salvam direto, sem abrir modal. É o painel que o atendente usa enquanto
 * conversa, então cada clique a menos conta.
 */
export function ContactPanel({
  contact,
  onClose,
  onChanged,
}: {
  contact: ConversationDetail["contact"];
  conversationId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [noteBody, setNoteBody] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const { data: tagsData } = useSWR<{ tags: TagWithCount[] }>("/api/tags", fetcher);
  const allTags = tagsData?.tags ?? [];

  async function updateContact(patch: Record<string, unknown>, successMessage: string) {
    try {
      await apiRequest(`/api/contacts/${contact.id}`, { method: "PATCH", body: patch });
      toast.success(successMessage);
      onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function addNote() {
    const body = noteBody.trim();
    if (!body || isSavingNote) return;

    setIsSavingNote(true);
    try {
      await apiRequest(`/api/contacts/${contact.id}/notes`, { method: "POST", body: { body } });
      setNoteBody("");
      onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSavingNote(false);
    }
  }

  async function deleteNote(noteId: string) {
    try {
      await apiRequest(`/api/notes/${noteId}`, { method: "DELETE" });
      onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="text-sm font-semibold">Informações</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="lg:hidden"
          aria-label="Fechar painel"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {/* Identificação */}
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <Avatar className="h-16 w-16">
            {contact.avatarUrl && <AvatarImage src={contact.avatarUrl} alt={contact.name} />}
            <AvatarFallback
              className="text-lg"
              style={{
                backgroundColor: stringToColor(contact.name),
                color: readableTextColor(stringToColor(contact.name)),
              }}
            >
              {getInitials(contact.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{contact.name}</p>
            <p className="text-xs text-muted-foreground">{formatPhone(contact.phone)}</p>
          </div>
        </div>

        <Separator />

        {/* Dados de contato */}
        <div className="space-y-2">
          <InfoRow icon={Phone} value={formatPhone(contact.phone)} />
          {contact.email && <InfoRow icon={Mail} value={contact.email} />}
          {contact.company && <InfoRow icon={Building2} value={contact.company} />}
        </div>

        <Separator />

        {/* Etapa do funil */}
        <section className="space-y-1.5">
          <label className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Etapa do funil
          </label>
          <Select
            value={contact.stage}
            onValueChange={(stage) => updateContact({ stage }, "Etapa atualizada")}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRM_STAGES.map((stage) => (
                <SelectItem key={stage.value} value={stage.value} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                    {stage.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Etiquetas */}
        <section className="space-y-1.5">
          <label className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Etiquetas
          </label>
          <TagPicker
            allTags={allTags}
            selectedIds={contact.tags.map((t) => t.id)}
            onChange={(tagIds) => updateContact({ tagIds }, "Etiquetas atualizadas")}
          />
        </section>

        <Separator />

        {/* Notas internas */}
        <section className="space-y-2">
          <div className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
            <label className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notas internas
            </label>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Visível apenas para a equipe — o cliente nunca vê.
          </p>

          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Escreva uma nota..."
            className="min-h-[60px] text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={addNote}
            disabled={!noteBody.trim() || isSavingNote}
            className="w-full"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar nota
          </Button>

          <ul className="space-y-2 pt-1">
            {contact.internalNotes.map((note) => (
              <li key={note.id} className="group rounded-md border border-border bg-muted/40 p-2">
                <p className="whitespace-pre-wrap break-words text-xs">{note.body}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {note.author?.name ?? "Sistema"} · {formatDateTime(note.createdAt)}
                  </span>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                    aria-label="Excluir nota"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{value}</span>
    </div>
  );
}
