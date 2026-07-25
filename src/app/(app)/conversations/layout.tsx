import type { Metadata } from "next";

import { ConversationsShell } from "@/components/conversations/conversations-shell";

export const metadata: Metadata = { title: "Conversas" };

/**
 * Coluna 1 (lista) é persistente entre as rotas de conversa — fica no layout
 * para não remontar/recarregar toda vez que o usuário troca de chat.
 */
export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  return <ConversationsShell>{children}</ConversationsShell>;
}
