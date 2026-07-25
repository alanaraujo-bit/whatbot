"use client";

import Link from "next/link";
import { GripVertical, MessageSquare } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CRM_STAGES } from "@/lib/crm";
import { formatPhone } from "@/lib/phone";
import { cn, getInitials, readableTextColor, stringToColor } from "@/lib/utils";
import type { ContactListItem } from "@/types";
import type { CrmStage } from "@prisma/client";

export function CrmCard({
  contact,
  isDragging,
  onDragStart,
  onDragEnd,
  onStageChange,
}: {
  contact: ContactListItem;
  isDragging: boolean;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onStageChange: (stage: CrmStage) => void;
}) {
  const conversationId = contact.conversations[0]?.id;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab rounded-md border border-border bg-background p-2 shadow-sm transition-all active:cursor-grabbing",
        "hover:border-foreground/20 hover:shadow",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback
            className="text-[10px]"
            style={{
              backgroundColor: stringToColor(contact.name),
              color: readableTextColor(stringToColor(contact.name)),
            }}
          >
            {getInitials(contact.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium leading-tight">{contact.name}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {formatPhone(contact.phone)}
          </p>
        </div>

        <GripVertical className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/50 md:block" />
      </div>

      {contact.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {contact.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="rounded px-1 py-px text-[10px] font-medium"
              style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-1">
        {conversationId ? (
          <Link
            href={`/conversations/${conversationId}`}
            className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <MessageSquare className="h-3 w-3" />
            Abrir conversa
          </Link>
        ) : (
          <span className="text-[10px] text-muted-foreground">Sem conversa</span>
        )}

        {/*
          Alternativa ao drag para toque: no mobile o HTML5 drag não dispara,
          então mover de etapa precisa deste menu.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:opacity-0 md:group-hover:opacity-100">
              Mover
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mover para</DropdownMenuLabel>
            {CRM_STAGES.filter((s) => s.value !== contact.stage).map((stage) => (
              <DropdownMenuItem key={stage.value} onClick={() => onStageChange(stage.value)}>
                <span className={cn("h-2 w-2 rounded-full", stage.dot)} />
                {stage.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
