"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatConversationTime } from "@/lib/format";
import { cn, getInitials, readableTextColor, stringToColor } from "@/lib/utils";
import type { ConversationListItem } from "@/types";

/**
 * Linha da lista de conversas.
 *
 * Densidade alta de propósito: avatar, nome, prévia, horário, não lidas e
 * etiquetas cabem em ~64px de altura, então uma tela mostra ~12 conversas.
 */
export function ConversationListItemRow({
  conversation,
  isActive,
}: {
  conversation: ConversationListItem;
  isActive: boolean;
}) {
  const { contact, unreadCount, lastMessagePreview, lastMessageAt, status } = conversation;
  const hasUnread = unreadCount > 0;

  return (
    <div
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 transition-colors",
        isActive ? "bg-secondary" : "hover:bg-accent/50"
      )}
    >
      <Avatar className="mt-0.5 h-9 w-9">
        {contact.avatarUrl && <AvatarImage src={contact.avatarUrl} alt={contact.name} />}
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
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm leading-tight",
              hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
            )}
          >
            {contact.name}
          </span>
          <span
            className={cn(
              "shrink-0 text-2xs",
              hasUnread ? "font-semibold text-primary" : "text-muted-foreground"
            )}
          >
            {formatConversationTime(lastMessageAt)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-xs",
              hasUnread ? "text-foreground/80" : "text-muted-foreground"
            )}
          >
            {lastMessagePreview || "Sem mensagens"}
          </span>

          {hasUnread && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        {(contact.tags.length > 0 || status === "CLOSED") && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {status === "CLOSED" && (
              <span className="rounded border border-border px-1 py-px text-[10px] font-medium text-muted-foreground">
                Finalizada
              </span>
            )}
            {/* Só duas etiquetas cabem sem quebrar a linha; o resto vira contador. */}
            {contact.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="rounded px-1 py-px text-[10px] font-medium"
                style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
            {contact.tags.length > 2 && (
              <span className="text-[10px] text-muted-foreground">
                +{contact.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
