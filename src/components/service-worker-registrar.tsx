"use client";

import { useEffect } from "react";

/**
 * Registra o service worker do PWA.
 *
 * Só em produção: em dev o SW atrapalha o hot-reload servindo assets do cache.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[pwa] falha ao registrar o service worker:", err);
      });
    };

    // Espera o load para não competir com os recursos críticos da primeira pintura.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
