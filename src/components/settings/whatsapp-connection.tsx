"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LogOut,
  Power,
  QrCode,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useRealtime } from "@/hooks/use-realtime";
import { apiRequest, fetcher } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { WhatsappSessionState } from "@/types";
import type { SessionStatus } from "@prisma/client";

const STATUS_META: Record<
  SessionStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "muted"; dot: string }
> = {
  CONNECTED: { label: "Conectado", variant: "default", dot: "bg-emerald-500" },
  CONNECTING: { label: "Conectando...", variant: "secondary", dot: "bg-amber-500 animate-pulse" },
  QR_PENDING: { label: "Aguardando leitura", variant: "secondary", dot: "bg-sky-500 animate-pulse" },
  DISCONNECTED: { label: "Desconectado", variant: "muted", dot: "bg-zinc-400" },
  FAILED: { label: "Falhou", variant: "destructive", dot: "bg-red-500" },
};

export function WhatsappConnection() {
  const [isWorking, setIsWorking] = useState(false);

  const { data, isLoading, mutate } = useSWR<WhatsappSessionState>(
    "/api/whatsapp/session",
    fetcher,
    {
      // Fallback de 5s: se um evento SSE se perder, a UI ainda converge.
      refreshInterval: 5000,
    }
  );

  useRealtime(
    useCallback(
      (event) => {
        if (event.type === "session:updated") mutate();
      },
      [mutate]
    )
  );

  async function connect() {
    setIsWorking(true);
    try {
      await apiRequest("/api/whatsapp/connect", { method: "POST" });
      toast.success("Iniciando conexão — o QR Code aparecerá em instantes");
      mutate();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsWorking(false);
    }
  }

  async function disconnect(logout: boolean) {
    if (
      logout &&
      !window.confirm(
        "Desvincular o número?\n\nAs credenciais serão apagadas e você precisará ler um novo QR Code para reconectar."
      )
    ) {
      return;
    }

    setIsWorking(true);
    try {
      await apiRequest(`/api/whatsapp/disconnect?logout=${logout}`, { method: "POST" });
      toast.success(logout ? "Número desvinculado" : "WhatsApp desconectado");
      mutate();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const session = data!;
  const meta = STATUS_META[session.status];
  const isConnected = session.status === "CONNECTED";
  const showQr = session.status === "QR_PENDING" && session.qrCode;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Smartphone className="h-4 w-4" />
                Conexão do WhatsApp
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Conecte o número que sua equipe usa para atender.
              </CardDescription>
            </div>

            <Badge variant={meta.variant} className="shrink-0 gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isConnected && (
            <div className="flex items-center gap-2.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 text-xs">
                <p className="font-medium">
                  {session.profileName || "Número conectado"}
                  {session.phoneNumber && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      · {formatPhone(session.phoneNumber)}
                    </span>
                  )}
                </p>
                {session.lastConnectedAt && (
                  <p className="text-muted-foreground">
                    Conectado desde {formatDateTime(session.lastConnectedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {session.status === "FAILED" && session.lastError && (
            <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0 text-xs">
                <p className="font-medium text-destructive">Falha na conexão</p>
                <p className="break-words text-muted-foreground">{session.lastError}</p>
              </div>
            </div>
          )}

          {showQr && (
            <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/30 p-4">
              <div className="rounded-lg bg-white p-2.5">
                {/* O QR vem como data URL do micro-serviço; `unoptimized` evita o loader do Next. */}
                <Image
                  src={session.qrCode!}
                  alt="QR Code para conectar o WhatsApp"
                  width={220}
                  height={220}
                  unoptimized
                  className="h-[220px] w-[220px]"
                />
              </div>

              <ol className="max-w-xs space-y-1 text-xs text-muted-foreground">
                <li>1. Abra o WhatsApp no celular</li>
                <li>
                  2. Toque em <strong className="text-foreground">Aparelhos conectados</strong>
                </li>
                <li>
                  3. Toque em <strong className="text-foreground">Conectar um aparelho</strong>
                </li>
                <li>4. Aponte a câmera para este código</li>
              </ol>

              <p className="text-[10px] text-muted-foreground">
                O código expira em cerca de 60 segundos e é renovado automaticamente.
              </p>
            </div>
          )}

          {session.status === "CONNECTING" && !showQr && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Estabelecendo conexão com o WhatsApp...
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-2">
            {!isConnected ? (
              <Button size="sm" onClick={connect} disabled={isWorking}>
                {isWorking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <QrCode className="h-3.5 w-3.5" />
                )}
                {session.status === "QR_PENDING" ? "Gerar novo QR Code" : "Conectar WhatsApp"}
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => disconnect(false)} disabled={isWorking}>
                  <Power className="h-3.5 w-3.5" />
                  Desconectar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => disconnect(true)}
                  disabled={isWorking}
                  className="text-destructive hover:text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Desvincular número
                </Button>
              </>
            )}

            <Button size="sm" variant="ghost" onClick={() => mutate()} disabled={isWorking}>
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed bg-muted/30">
        <CardContent className="space-y-1.5 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Sobre a integração</p>
          <p>
            O MVP usa <strong>Baileys</strong> (conexão via QR Code, não oficial), que roda num
            serviço separado na porta{" "}
            <code className="rounded bg-background px-1">4000</code>. Se o status não sair de
            &quot;Desconectado&quot;, confirme que o processo{" "}
            <code className="rounded bg-background px-1">WHATSAPP</code> subiu junto com{" "}
            <code className="rounded bg-background px-1">npm run dev</code>.
          </p>
          <p>
            A arquitetura já está preparada para a <strong>Cloud API oficial da Meta</strong> —
            basta trocar <code className="rounded bg-background px-1">WHATSAPP_PROVIDER</code> no{" "}
            <code className="rounded bg-background px-1">.env</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
