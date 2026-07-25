import { auth } from "@/auth";
import { subscribe, type AppEvent } from "@/server/events";

export const dynamic = "force-dynamic";
// SSE precisa do runtime Node: o Edge não mantém o stream aberto do mesmo jeito.
export const runtime = "nodejs";

/**
 * Stream de eventos em tempo real (Server-Sent Events).
 *
 * Escolhemos SSE em vez de WebSocket porque o tráfego é unidirecional
 * (servidor → navegador), atravessa proxies sem configuração extra e o
 * browser reconecta sozinho ao cair.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return new Response("Não autenticado", { status: 401 });
  }

  const workspaceId = session.user.workspaceId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Cliente sumiu entre o check e o enqueue.
          closed = true;
        }
      };

      // Estabelece o stream imediatamente para o EventSource disparar `onopen`.
      send(": conectado\n\n");

      const unsubscribe = subscribe(workspaceId, (event: AppEvent) => {
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });

      // Heartbeat: sem tráfego, proxies costumam derrubar a conexão em ~60s.
      const heartbeat = setInterval(() => send(": ping\n\n"), 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Já fechado pelo runtime.
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Desativa buffering no nginx, que senão segura os eventos.
      "X-Accel-Buffering": "no",
    },
  });
}
