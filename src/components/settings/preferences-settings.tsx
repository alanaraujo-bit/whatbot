"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Bell, BellOff, Loader2, PenLine, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiRequest, fetcher } from "@/lib/fetcher";
import { playNotificationSound } from "@/lib/notification-sound";

type WorkspaceSettings = {
  id: string;
  name: string;
  agentSignatureEnabled: boolean;
  notificationSoundEnabled: boolean;
};

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function PreferencesSettings() {
  const { data: session } = useSession();
  const { data, isLoading, mutate } = useSWR<{ workspace: WorkspaceSettings }>(
    "/api/workspace",
    fetcher
  );

  const [permission, setPermission] = useState<PermissionState>("default");

  // `Notification` não existe em SSR nem em alguns navegadores móveis.
  useEffect(() => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  async function requestPermission() {
    if (typeof Notification === "undefined") return;

    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);

    if (result === "granted") {
      toast.success("Notificações ativadas");
      playNotificationSound();
    } else if (result === "denied") {
      toast.error("Permissão negada — libere nas configurações do navegador");
    }
  }

  async function update(patch: Partial<WorkspaceSettings>, mensagem: string) {
    try {
      await apiRequest("/api/workspace", { method: "PATCH", body: patch });
      toast.success(mensagem);
      mutate();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  const workspace = data!.workspace;
  const firstName = (session?.user?.name ?? "Ana").split(/\s+/)[0];

  return (
    <div className="space-y-4">
      {/* --- Assinatura do atendente --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <PenLine className="h-4 w-4" />
            Assinatura do atendente
          </CardTitle>
          <CardDescription className="text-xs">
            Identifica quem está respondendo. Útil quando mais de uma pessoa atende o mesmo número.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Assinar mensagens enviadas</p>
              <p className="text-[11px] text-muted-foreground">
                O nome vai no texto enviado, mas não aparece no histórico interno.
              </p>
            </div>
            <Switch
              checked={workspace.agentSignatureEnabled}
              onCheckedChange={(checked) =>
                update(
                  { agentSignatureEnabled: checked },
                  checked ? "Assinatura ativada" : "Assinatura desativada"
                )
              }
            />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
              Como o cliente recebe:
            </p>
            <div className="rounded-lg rounded-br-sm bg-bubble-out px-3 py-2 text-sm">
              {workspace.agentSignatureEnabled && (
                <p className="font-semibold">{firstName}:</p>
              )}
              <p>Boa tarde! Já verifiquei seu pedido, ele sai hoje.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- Notificações --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4" />
            Notificações
          </CardTitle>
          <CardDescription className="text-xs">
            Avisa quando chega mensagem e você está em outra aba.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
            <div className="min-w-0">
              <p className="text-xs font-medium">Som ao receber mensagem</p>
              <p className="text-[11px] text-muted-foreground">
                Só toca com a aba em segundo plano.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => playNotificationSound()}
                aria-label="Ouvir o som"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
              <Switch
                checked={workspace.notificationSoundEnabled}
                onCheckedChange={(checked) =>
                  update(
                    { notificationSoundEnabled: checked },
                    checked ? "Som ativado" : "Som desativado"
                  )
                }
              />
            </div>
          </div>

          <div className="rounded-md border border-border p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium">Notificações do sistema</p>
                <p className="text-[11px] text-muted-foreground">
                  {permission === "granted" && "Ativadas neste navegador."}
                  {permission === "default" &&
                    "O navegador precisa da sua permissão para exibir avisos."}
                  {permission === "denied" &&
                    "Bloqueadas. Libere no cadeado da barra de endereço."}
                  {permission === "unsupported" &&
                    "Este navegador não suporta notificações."}
                </p>
              </div>

              {permission === "granted" ? (
                <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <Bell className="h-3.5 w-3.5" />
                  Ativas
                </span>
              ) : permission === "denied" || permission === "unsupported" ? (
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <BellOff className="h-3.5 w-3.5" />
                  Indisponível
                </span>
              ) : (
                <Button size="sm" variant="outline" onClick={requestPermission} className="shrink-0">
                  Ativar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
