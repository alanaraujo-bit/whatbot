"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Send, Smile } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/fetcher";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 4096;

export function MessageComposer({
  conversationId,
  contactName,
  onSent,
}: {
  conversationId: string;
  contactName: string;
  onSent: () => void;
}) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Cresce até 6 linhas e depois rola internamente. */
  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }

  async function send() {
    const text = content.trim();
    if (!text || isSending) return;

    setIsSending(true);
    // Limpa otimisticamente: o campo travado com o texto dá sensação de lentidão.
    setContent("");
    requestAnimationFrame(autoResize);

    try {
      await apiRequest("/api/messages", {
        method: "POST",
        body: { conversationId, content: text },
      });
      onSent();
    } catch (error) {
      // Devolve o texto para o usuário não perder o que escreveu.
      setContent(text);
      requestAnimationFrame(autoResize);
      toast.error((error as Error).message);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra linha — convenção de app de mensagem.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-background px-2 py-2 md:px-3">
      <div className="mx-auto flex max-w-3xl items-end gap-1.5">
        {/* Anexos entram na v2; o botão fica visível para não mudar o layout depois. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled aria-label="Anexar arquivo">
              <Paperclip className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Anexos em breve</TooltipContent>
        </Tooltip>

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value.slice(0, MAX_LENGTH));
              autoResize();
            }}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Mensagem para ${contactName}...`}
            className={cn(
              "scrollbar-none w-full resize-none rounded-2xl border border-input bg-background px-3 py-2 text-sm shadow-sm",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            )}
          />
          {content.length > MAX_LENGTH - 200 && (
            <span className="absolute -top-5 right-1 text-[10px] text-muted-foreground">
              {content.length}/{MAX_LENGTH}
            </span>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled aria-label="Emoji">
              <Smile className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Emojis em breve</TooltipContent>
        </Tooltip>

        <Button
          size="icon"
          onClick={send}
          disabled={!content.trim() || isSending}
          className="rounded-full"
          aria-label="Enviar mensagem"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
