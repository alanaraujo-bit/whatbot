"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, fetcher } from "@/lib/fetcher";
import type { TagWithCount } from "@/types";

/** Paleta pré-definida — evita etiquetas com cor ilegível escolhida na mão. */
const PRESET_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#64748b",
];

export function TagsSettings() {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading, mutate } = useSWR<{ tags: TagWithCount[] }>("/api/tags", fetcher);
  const tags = data?.tags ?? [];

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    try {
      await apiRequest("/api/tags", { method: "POST", body: { name: trimmed, color } });
      setName("");
      toast.success("Etiqueta criada");
      mutate();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(tag: TagWithCount) {
    const message =
      tag._count.contacts > 0
        ? `Excluir "${tag.name}"?\n\nEla será removida de ${tag._count.contacts} contato(s). Os contatos em si não são afetados.`
        : `Excluir a etiqueta "${tag.name}"?`;

    if (!window.confirm(message)) return;

    try {
      await apiRequest(`/api/tags/${tag.id}`, { method: "DELETE" });
      toast.success("Etiqueta excluída");
      mutate();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Nova etiqueta</CardTitle>
          <CardDescription className="text-xs">
            Use etiquetas para segmentar contatos: origem, interesse, status de pagamento.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tag-name">Nome</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Cliente VIP"
              maxLength={40}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  aria-label={`Cor ${preset}`}
                  className="h-7 w-7 rounded-md border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: preset,
                    borderColor: color === preset ? "currentColor" : "transparent",
                  }}
                />
              ))}
            </div>
          </div>

          <Button size="sm" onClick={create} disabled={!name.trim() || isSaving}>
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Criar etiqueta
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Etiquetas ({tags.length})</CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading && !data ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : tags.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhuma etiqueta criada ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {tags.map((tag) => (
                <li key={tag.id} className="flex items-center gap-3 py-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 truncate text-sm">{tag.name}</span>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {tag._count.contacts} contato(s)
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(tag)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Excluir ${tag.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
