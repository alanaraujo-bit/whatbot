"use client";

import { AlertCircle, Bot, Check, CheckCheck, Clock } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateTime, formatMessageTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MessageItem } from "@/types";

/** Indicador de entrega, no padrão dos "tiquinhos" do WhatsApp. */
function StatusIcon({ status }: { status: MessageItem["status"] }) {
  switch (status) {
    case "PENDING":
      return <Clock className="h-3 w-3 opacity-60" />;
    case "SENT":
      return <Check className="h-3 w-3 opacity-70" />;
    case "DELIVERED":
      return <CheckCheck className="h-3 w-3 opacity-70" />;
    case "READ":
      return <CheckCheck className="h-3 w-3 text-sky-500" />;
    case "FAILED":
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
}

export function MessageBubble({
  message,
  isGrouped,
}: {
  message: MessageItem;
  isGrouped: boolean;
}) {
  const isOutbound = message.direction === "OUTBOUND";
  const failed = message.status === "FAILED";

  return (
    <div
      className={cn(
        "flex w-full animate-fade-in",
        isOutbound ? "justify-end" : "justify-start",
        isGrouped ? "mt-0.5" : "mt-2"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-2.5 py-1.5 shadow-sm sm:max-w-[70%]",
          isOutbound
            ? "rounded-br-sm bg-bubble-out text-foreground"
            : "rounded-bl-sm bg-bubble-in text-foreground",
          // Cantos arredondados só na primeira da sequência.
          isGrouped && (isOutbound ? "rounded-tr-xl" : "rounded-tl-xl"),
          failed && "border border-destructive/40"
        )}
      >
        {message.isAutomated && (
          <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Bot className="h-3 w-3" />
            Resposta automática
          </div>
        )}

        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content}
        </p>

        <div
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground"
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{formatMessageTime(message.timestamp)}</span>
            </TooltipTrigger>
            <TooltipContent>
              {formatDateTime(message.timestamp)}
              {message.sentBy && ` · ${message.sentBy.name}`}
            </TooltipContent>
          </Tooltip>

          {isOutbound && <StatusIcon status={message.status} />}
        </div>

        {failed && (
          <p className="mt-1 text-[10px] font-medium text-destructive">
            Falha no envio — verifique a conexão do WhatsApp
          </p>
        )}
      </div>
    </div>
  );
}
