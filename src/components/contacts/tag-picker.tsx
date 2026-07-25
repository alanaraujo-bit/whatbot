"use client";

import { Check, Tag as TagIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { TagSummary } from "@/types";

/**
 * Seletor múltiplo de etiquetas.
 *
 * Mostra as selecionadas como chips e abre um popover com todas as opções.
 * `onChange` recebe a lista completa de ids — a API faz `set`, não `connect`.
 */
export function TagPicker({
  allTags,
  selectedIds,
  onChange,
  className,
}: {
  allTags: TagSummary[];
  selectedIds: string[];
  onChange: (tagIds: string[]) => void;
  className?: string;
}) {
  const selected = allTags.filter((t) => selectedIds.includes(t.id));

  function toggle(tagId: string) {
    onChange(
      selectedIds.includes(tagId)
        ? selectedIds.filter((id) => id !== tagId)
        : [...selectedIds, tagId]
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((tag) => (
            <span
              key={tag.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 w-full justify-start text-xs">
            <TagIcon className="h-3.5 w-3.5" />
            {selected.length > 0 ? `${selected.length} selecionada(s)` : "Adicionar etiqueta"}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-56 p-1">
          {allTags.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              Nenhuma etiqueta criada. Crie em Configurações › Etiquetas.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {allTags.map((tag) => {
                const isSelected = selectedIds.includes(tag.id);
                return (
                  <li key={tag.id}>
                    <button
                      onClick={() => toggle(tag.id)}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 truncate text-left">{tag.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
