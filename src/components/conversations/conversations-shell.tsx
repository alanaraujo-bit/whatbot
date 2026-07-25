"use client";

import { usePathname } from "next/navigation";

import { ConversationList } from "@/components/conversations/conversation-list";
import { cn } from "@/lib/utils";

/**
 * Casca do módulo de conversas.
 *
 * Desktop: lista (340px) + conteúdo, lado a lado.
 * Mobile: uma tela por vez — a lista some quando há conversa aberta, que é o
 * comportamento esperado de um app de mensagens no celular.
 */
export function ConversationsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasSelection = /^\/conversations\/[^/]+$/.test(pathname);

  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn(
          "w-full shrink-0 border-r border-border md:w-[340px]",
          hasSelection && "hidden md:block"
        )}
      >
        <ConversationList />
      </div>

      <div className={cn("min-w-0 flex-1", !hasSelection && "hidden md:flex")}>{children}</div>
    </div>
  );
}
