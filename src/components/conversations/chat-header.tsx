"use client";

import Link from "next/link";
import { ArrowLeft, Check, CircleSlash, Info, MoreVertical } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONVERSATION_STATUS_LABELS } from "@/lib/crm";
import { apiRequest } from "@/lib/fetcher";
import { formatPhone } from "@/lib/phone";
import { getInitials, readableTextColor, stringToColor } from "@/lib/utils";
import type { ConversationDetail } from "@/types";

export function ChatHeader({
  conversation,
  panelOpen,
  onTogglePanel,
  onChanged,
}: {
  conversation: ConversationDetail;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onChanged: () => void;
}) {
  const { contact } = conversation;

  async function updateStatus(status: "OPEN" | "CLOSED") {
    try {
      await apiRequest(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        body: { status },
      });
      toast.success(status === "CLOSED" ? "Conversa finalizada" : "Conversa reaberta");
      onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-2 md:px-3">
      {/* Voltar só existe no mobile, onde a lista foi substituída pelo chat. */}
      <Button variant="ghost" size="icon-sm" asChild className="md:hidden">
        <Link href="/conversations" aria-label="Voltar para a lista">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>

      <Avatar className="h-8 w-8">
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
        <p className="truncate text-sm font-medium leading-tight">{contact.name}</p>
        <p className="truncate text-2xs text-muted-foreground">
          {formatPhone(contact.phone)}
          {conversation.status !== "OPEN" && (
            <> · {CONVERSATION_STATUS_LABELS[conversation.status]}</>
          )}
        </p>
      </div>

      <Button
        variant={panelOpen ? "secondary" : "ghost"}
        size="icon-sm"
        onClick={onTogglePanel}
        className="lg:hidden"
        aria-label="Informações do contato"
      >
        <Info className="h-4 w-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Mais ações">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {conversation.status === "CLOSED" ? (
            <DropdownMenuItem onClick={() => updateStatus("OPEN")}>
              <Check className="h-4 w-4" />
              Reabrir conversa
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => updateStatus("CLOSED")}>
              <CircleSlash className="h-4 w-4" />
              Finalizar conversa
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/contacts?highlight=${contact.id}`}>Ver contato completo</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
