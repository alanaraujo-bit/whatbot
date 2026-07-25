"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { playNotificationSound } from "@/lib/notification-sound";
import type { WorkspaceStats } from "@/types";

/**
 * Avisa sobre mensagens novas enquanto o atendente está em outra aba.
 *
 * Observa o total de conversas não lidas (`/api/stats` é um payload pequeno,
 * ao contrário da lista de conversas) e dispara som + notificação do sistema
 * quando o número sobe.
 *
 * Fica montado no layout autenticado, então funciona em qualquer página.
 */
export function NotificationWatcher() {
  const { data } = useSWR<WorkspaceStats>("/api/stats", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  // Mesma chave usada na tela de Preferências: o SWR compartilha o cache.
  const { data: settings } = useSWR<{ workspace: { notificationSoundEnabled: boolean } }>(
    "/api/workspace",
    fetcher
  );
  const soundEnabled = settings?.workspace.notificationSoundEnabled ?? true;

  /**
   * `undefined` marca a primeira leitura: sem isso, abrir o app com 3 conversas
   * não lidas dispararia notificação para mensagens antigas.
   */
  const previousUnread = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (data?.unread === undefined) return;

    const previous = previousUnread.current;
    previousUnread.current = data.unread;

    if (previous === undefined || data.unread <= previous) return;

    // Com a aba em foco o atendente já está vendo a lista atualizar sozinha;
    // som nesse momento vira ruído.
    if (typeof document !== "undefined" && !document.hidden) return;

    if (soundEnabled) playNotificationSound();

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const novas = data.unread - (previous ?? 0);
      const notification = new Notification("Wapply", {
        body:
          novas === 1
            ? "Você recebeu uma nova mensagem"
            : `Você recebeu ${novas} novas mensagens`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        // Substitui a notificação anterior em vez de empilhar uma pilha delas.
        tag: "wapply-mensagens",
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, [data?.unread, soundEnabled]);

  return null;
}
