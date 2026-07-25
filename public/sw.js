/**
 * Service Worker do Wapply.
 *
 * Estratégia deliberadamente conservadora para um CRM:
 *
 *  - Navegações  → network-first com fallback para a página offline.
 *  - Assets      → stale-while-revalidate (rápido, atualiza em segundo plano).
 *  - API/auth/SSE → NUNCA cacheados. Servir uma conversa ou um status de
 *                   conexão obsoleto seria pior do que mostrar um erro.
 */

const VERSION = "v1";
const STATIC_CACHE = `wapply-static-${VERSION}`;
const RUNTIME_CACHE = `wapply-runtime-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Assume o controle sem esperar o usuário fechar todas as abas.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Requisições que nunca devem passar pelo cache. */
function isBypassed(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname === "/sw.js"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Só lidamos com GET de mesma origem.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (isBypassed(url)) return;

  // Navegações: rede primeiro, offline.html como último recurso.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        return cached ?? caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Assets: responde do cache e revalida em paralelo.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached ?? network;
    })
  );
});
