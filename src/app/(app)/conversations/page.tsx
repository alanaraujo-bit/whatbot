import { MessagesSquare } from "lucide-react";

/**
 * Estado vazio da coluna 2 no desktop.
 * No mobile esta rota mostra só a lista (a coluna é escondida pelo shell).
 */
export default function ConversationsIndexPage() {
  return (
    <div className="chat-canvas hidden h-full flex-col items-center justify-center gap-3 md:flex">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <MessagesSquare className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Selecione uma conversa</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Escolha um contato à esquerda para ver o histórico e responder.
        </p>
      </div>
    </div>
  );
}
