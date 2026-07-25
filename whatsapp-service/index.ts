/**
 * ==========================================================================
 * Wapply — Micro-serviço de WhatsApp (Baileys)
 * ==========================================================================
 *
 * POR QUE UM SERVIÇO SEPARADO
 * ---------------------------
 * Baileys mantém um WebSocket vivo com os servidores do WhatsApp e guarda
 * chaves de criptografia em memória + disco. O runtime das rotas do Next.js
 * não garante um processo persistente (módulos são recarregados, handlers
 * podem ser servidos por workers diferentes), então o socket morreria a cada
 * hot-reload. Isolar num processo Node comum resolve isso e ainda permite
 * escalar/reiniciar a integração sem derrubar a aplicação web.
 *
 * COMO CONVERSA COM O NEXT.JS
 * ---------------------------
 *   Next  → serviço : HTTP REST (conectar, status, enviar) autenticado por token
 *   serviço → Next  : webhook POST /api/whatsapp/webhook com o mesmo token
 *
 * As credenciais de cada sessão ficam em `whatsapp-service/sessions/<id>/`
 * (ignorado pelo git — são credenciais reais do número).
 */
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import cors from "cors";
import pino from "pino";
import QRCode from "qrcode";
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";

// --------------------------------------------------------------------------
// Configuração
// --------------------------------------------------------------------------

/** Carrega o .env sem depender do pacote dotenv. */
async function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  try {
    const content = await fs.readFile(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["'](.*)["']$/, "$1");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    console.warn("[wa] .env não encontrado — usando variáveis do ambiente");
  }
}

await loadEnv();

// Railway (e a maioria dos PaaS) injeta a porta via PORT.
const PORT = Number(process.env.PORT ?? process.env.WHATSAPP_SERVICE_PORT ?? 4000);
const WEBHOOK_URL = process.env.WHATSAPP_WEBHOOK_URL ?? "http://localhost:3000/api/whatsapp/webhook";
const SERVICE_TOKEN = process.env.WHATSAPP_SERVICE_TOKEN ?? "";

/**
 * Onde ficam as credenciais das sessões.
 *
 * Em produção isto PRECISA apontar para um volume persistente (ex.: /data no
 * Railway). Sem persistência, todo redeploy apaga o pareamento e exige ler o
 * QR Code de novo.
 */
const SESSIONS_DIR =
  process.env.WHATSAPP_SESSIONS_DIR ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), "sessions");

/** Baileys é extremamente verboso; só queremos os erros. */
const logger = pino({ level: "error" });

if (!SERVICE_TOKEN) {
  console.error(
    "\n[wa] ERRO: WHATSAPP_SERVICE_TOKEN não está definido no .env.\n" +
      "      Sem ele o webhook fica aberto. Copie o .env.example e defina um valor.\n"
  );
  process.exit(1);
}

// --------------------------------------------------------------------------
// Tipos e estado
// --------------------------------------------------------------------------

type SessionStatus = "DISCONNECTED" | "CONNECTING" | "QR_PENDING" | "CONNECTED" | "FAILED";

type SessionRuntime = {
  id: string;
  sock: WASocket | null;
  status: SessionStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  profileName: string | null;
  error: string | null;
  reconnectAttempts: number;
  /** True quando a desconexão partiu do usuário — impede reconexão automática. */
  intentionalClose: boolean;
};

/** Sessões vivas, indexadas pelo id do WhatsappSession no banco. */
const sessions = new Map<string, SessionRuntime>();

const MAX_RECONNECT_ATTEMPTS = 5;

function getOrCreateRuntime(sessionId: string): SessionRuntime {
  let runtime = sessions.get(sessionId);
  if (!runtime) {
    runtime = {
      id: sessionId,
      sock: null,
      status: "DISCONNECTED",
      qrCode: null,
      phoneNumber: null,
      profileName: null,
      error: null,
      reconnectAttempts: 0,
      intentionalClose: false,
    };
    sessions.set(sessionId, runtime);
  }
  return runtime;
}

function publicState(runtime: SessionRuntime) {
  return {
    status: runtime.status,
    qrCode: runtime.qrCode,
    phoneNumber: runtime.phoneNumber,
    profileName: runtime.profileName,
    error: runtime.error,
  };
}

// --------------------------------------------------------------------------
// Webhook (serviço -> Next.js)
// --------------------------------------------------------------------------

type WebhookEvent =
  | {
      type: "status";
      sessionId: string;
      status: SessionStatus;
      qrCode?: string | null;
      phoneNumber?: string | null;
      profileName?: string | null;
      error?: string | null;
    }
  | {
      type: "message";
      sessionId: string;
      message: {
        externalId: string;
        from: string;
        pushName?: string | null;
        text: string;
        timestamp: number;
        mediaType?: string | null;
        fromMe?: boolean;
        /** URL da foto de perfil do contato, quando pública. */
        profilePicUrl?: string | null;
      };
    }
  | {
      type: "message-status";
      sessionId: string;
      externalId: string;
      status: "DELIVERED" | "READ" | "FAILED";
    };

/**
 * Entrega um evento ao Next.js.
 *
 * Falhas são logadas mas nunca propagadas: o app web pode estar reiniciando e
 * isso não pode derrubar o socket do WhatsApp.
 */
async function postWebhook(event: WebhookEvent): Promise<void> {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-token": SERVICE_TOKEN,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.warn(`[wa] webhook respondeu ${response.status}: ${await response.text()}`);
    }
  } catch (error) {
    console.warn("[wa] falha ao entregar webhook:", (error as Error).message);
  }
}

/** Atualiza o estado local e avisa o Next.js. */
async function pushStatus(runtime: SessionRuntime, status: SessionStatus, error?: string | null) {
  runtime.status = status;
  runtime.error = error ?? null;
  if (status !== "QR_PENDING") runtime.qrCode = null;

  await postWebhook({
    type: "status",
    sessionId: runtime.id,
    status,
    qrCode: runtime.qrCode,
    phoneNumber: runtime.phoneNumber,
    profileName: runtime.profileName,
    error: runtime.error,
  });
}

// --------------------------------------------------------------------------
// Extração de conteúdo das mensagens
// --------------------------------------------------------------------------

/**
 * Converte a mensagem do Baileys em texto + tipo de mídia.
 *
 * O MVP só envia texto, mas precisa EXIBIR o que chega. Mídias viram um
 * marcador legível ("📷 Imagem") em vez de sumirem da conversa.
 */
function extractContent(message: proto.IMessage | null | undefined): {
  text: string;
  mediaType: string | null;
} {
  if (!message) return { text: "", mediaType: null };

  if (message.conversation) {
    return { text: message.conversation, mediaType: null };
  }
  if (message.extendedTextMessage?.text) {
    return { text: message.extendedTextMessage.text, mediaType: null };
  }
  if (message.imageMessage) {
    return { text: message.imageMessage.caption || "📷 Imagem", mediaType: "image" };
  }
  if (message.videoMessage) {
    return { text: message.videoMessage.caption || "🎬 Vídeo", mediaType: "video" };
  }
  if (message.audioMessage) {
    return { text: "🎤 Áudio", mediaType: "audio" };
  }
  if (message.documentMessage) {
    return {
      text: `📄 ${message.documentMessage.fileName || "Documento"}`,
      mediaType: "document",
    };
  }
  if (message.stickerMessage) {
    return { text: "Figurinha", mediaType: "sticker" };
  }
  if (message.locationMessage) {
    return { text: "📍 Localização", mediaType: "location" };
  }
  if (message.contactMessage || message.contactsArrayMessage) {
    return { text: "👤 Contato", mediaType: "contact" };
  }
  if (message.reactionMessage?.text) {
    return { text: message.reactionMessage.text, mediaType: null };
  }

  // Mensagens efêmeras/view-once vêm embrulhadas em outra camada.
  if (message.ephemeralMessage?.message) {
    return extractContent(message.ephemeralMessage.message);
  }
  if (message.viewOnceMessage?.message) {
    return extractContent(message.viewOnceMessage.message);
  }
  if (message.viewOnceMessageV2?.message) {
    return extractContent(message.viewOnceMessageV2.message);
  }

  return { text: "", mediaType: null };
}

// --------------------------------------------------------------------------
// Foto de perfil
// --------------------------------------------------------------------------

/**
 * URLs de foto de perfil expiram, então guardamos em cache curto para não
 * consultar o WhatsApp a cada mensagem — um contato tagarela geraria dezenas
 * de chamadas por minuto, e o WhatsApp limita esse endpoint com rigor.
 */
const profilePicCache = new Map<string, { url: string | null; fetchedAt: number }>();
const PROFILE_PIC_TTL = 6 * 60 * 60 * 1000; // 6 horas

async function getProfilePicture(sock: WASocket, jid: string): Promise<string | null> {
  const cached = profilePicCache.get(jid);
  if (cached && Date.now() - cached.fetchedAt < PROFILE_PIC_TTL) {
    return cached.url;
  }

  let url: string | null = null;
  try {
    // "image" devolve a foto em alta; "preview" seria a miniatura.
    url = (await sock.profilePictureUrl(jid, "image")) ?? null;
  } catch {
    // 404 é o caso normal: o contato não tem foto ou restringiu quem pode vê-la.
    url = null;
  }

  profilePicCache.set(jid, { url, fetchedAt: Date.now() });
  return url;
}

// --------------------------------------------------------------------------
// Ciclo de vida da sessão Baileys
// --------------------------------------------------------------------------

async function startSession(sessionId: string): Promise<SessionRuntime> {
  const runtime = getOrCreateRuntime(sessionId);

  // Já existe socket ativo: nada a fazer.
  if (runtime.sock && (runtime.status === "CONNECTED" || runtime.status === "QR_PENDING")) {
    return runtime;
  }

  runtime.intentionalClose = false;
  runtime.status = "CONNECTING";
  runtime.error = null;

  const authDir = path.join(SESSIONS_DIR, sessionId);
  await fs.mkdir(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      // O cache de chaves reduz muito a leitura de disco em conversas ativas.
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    // Identifica a sessão na lista de "Aparelhos conectados" do WhatsApp.
    browser: ["Wapply", "Chrome", "1.0.0"],
    // Não marcamos automaticamente como online: o "visto por último" do
    // número não deve mudar só porque o CRM está aberto.
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  runtime.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  // --- Conexão ----------------------------------------------------------
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        runtime.qrCode = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
        await pushStatus(runtime, "QR_PENDING");
        console.log(`[wa] QR Code gerado para a sessão ${sessionId}`);
      } catch (error) {
        console.error("[wa] falha ao gerar QR Code:", error);
      }
    }

    if (connection === "open") {
      runtime.reconnectAttempts = 0;
      runtime.qrCode = null;
      runtime.phoneNumber = sock.user?.id ? sock.user.id.split(":")[0].split("@")[0] : null;
      runtime.profileName = sock.user?.name ?? null;
      await pushStatus(runtime, "CONNECTED");
      console.log(`[wa] sessão ${sessionId} conectada como ${runtime.phoneNumber}`);
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
        ?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      runtime.sock = null;

      if (runtime.intentionalClose) {
        await pushStatus(runtime, "DISCONNECTED");
        return;
      }

      if (loggedOut) {
        // O usuário removeu o aparelho no celular: as credenciais não servem mais.
        console.log(`[wa] sessão ${sessionId} deslogada no aparelho — limpando credenciais`);
        await clearAuthFiles(sessionId);
        runtime.phoneNumber = null;
        runtime.profileName = null;
        await pushStatus(runtime, "DISCONNECTED", "Sessão encerrada no aparelho");
        return;
      }

      if (runtime.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        await pushStatus(
          runtime,
          "FAILED",
          `Não foi possível reconectar após ${MAX_RECONNECT_ATTEMPTS} tentativas`
        );
        return;
      }

      // Backoff exponencial limitado a 30s.
      runtime.reconnectAttempts += 1;
      const delay = Math.min(2 ** runtime.reconnectAttempts * 1000, 30_000);
      console.log(
        `[wa] sessão ${sessionId} caiu (código ${statusCode ?? "?"}); ` +
          `reconectando em ${delay / 1000}s (tentativa ${runtime.reconnectAttempts})`
      );
      await pushStatus(runtime, "CONNECTING");

      setTimeout(() => {
        startSession(sessionId).catch((error) =>
          console.error(`[wa] falha ao reconectar ${sessionId}:`, error)
        );
      }, delay);
    }
  });

  // --- Mensagens recebidas ---------------------------------------------
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // "append" traz histórico antigo; só nos interessa o que chega agora.
    if (type !== "notify") return;

    for (const msg of messages) {
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || remoteJid === "status@broadcast") continue;
      if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) continue;

      const { text, mediaType } = extractContent(msg.message);
      if (!text) continue; // protocolo/recibo, não é mensagem de verdade

      const profilePicUrl = await getProfilePicture(sock, remoteJid);

      await postWebhook({
        type: "message",
        sessionId,
        message: {
          externalId: msg.key.id ?? `${remoteJid}-${Date.now()}`,
          from: remoteJid,
          pushName: msg.pushName ?? null,
          text,
          timestamp: Number(msg.messageTimestamp ?? Math.floor(Date.now() / 1000)),
          mediaType,
          fromMe: Boolean(msg.key.fromMe),
          profilePicUrl,
        },
      });
    }
  });

  // --- Confirmações de entrega/leitura ----------------------------------
  sock.ev.on("messages.update", async (updates) => {
    for (const { key, update } of updates) {
      if (!key.id || update.status == null) continue;

      // Enum do Baileys: 2 = DELIVERY_ACK, 3 = READ, 4 = PLAYED.
      let status: "DELIVERED" | "READ" | null = null;
      if (update.status === 2) status = "DELIVERED";
      else if (update.status === 3 || update.status === 4) status = "READ";
      if (!status) continue;

      await postWebhook({ type: "message-status", sessionId, externalId: key.id, status });
    }
  });

  return runtime;
}

/** Fecha o socket sem apagar credenciais. */
async function stopSession(sessionId: string): Promise<void> {
  const runtime = sessions.get(sessionId);
  if (!runtime) return;

  runtime.intentionalClose = true;
  runtime.reconnectAttempts = 0;

  if (runtime.sock) {
    try {
      // `end` fecha o WebSocket sem invalidar as credenciais no servidor.
      runtime.sock.end(undefined);
    } catch (error) {
      console.warn("[wa] erro ao encerrar socket:", (error as Error).message);
    }
    runtime.sock = null;
  }

  await pushStatus(runtime, "DISCONNECTED");
}

/** Fecha o socket E apaga as credenciais (exige novo QR depois). */
async function logoutSession(sessionId: string): Promise<void> {
  const runtime = sessions.get(sessionId);

  if (runtime?.sock) {
    runtime.intentionalClose = true;
    try {
      // `logout` avisa o WhatsApp para remover o aparelho da lista.
      await runtime.sock.logout();
    } catch (error) {
      console.warn("[wa] erro no logout remoto:", (error as Error).message);
    }
    runtime.sock = null;
  }

  await clearAuthFiles(sessionId);

  if (runtime) {
    runtime.phoneNumber = null;
    runtime.profileName = null;
    await pushStatus(runtime, "DISCONNECTED");
  }
}

async function clearAuthFiles(sessionId: string): Promise<void> {
  const authDir = path.join(SESSIONS_DIR, sessionId);
  await fs.rm(authDir, { recursive: true, force: true });
}

// --------------------------------------------------------------------------
// API HTTP
// --------------------------------------------------------------------------

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

/** Todas as rotas exigem o token compartilhado com o Next.js. */
app.use((req, res, next) => {
  if (req.path === "/health") return next();

  if (req.header("x-service-token") !== SERVICE_TOKEN) {
    res.status(401).json({ error: "Token de serviço inválido" });
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "wapply-whatsapp",
    sessions: sessions.size,
    uptime: Math.round(process.uptime()),
  });
});

app.post("/sessions/:id/connect", async (req, res) => {
  try {
    const runtime = await startSession(req.params.id);
    res.json(publicState(runtime));
  } catch (error) {
    console.error("[wa] erro em /connect:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/sessions/:id/status", (req, res) => {
  const runtime = sessions.get(req.params.id);
  res.json(
    runtime
      ? publicState(runtime)
      : { status: "DISCONNECTED", qrCode: null, phoneNumber: null, profileName: null, error: null }
  );
});

app.post("/sessions/:id/disconnect", async (req, res) => {
  try {
    await stopSession(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/sessions/:id/logout", async (req, res) => {
  try {
    await logoutSession(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/sessions/:id/messages", async (req, res) => {
  const { to, text } = req.body as { to?: string; text?: string };

  if (!to || !text) {
    res.status(400).json({ error: "Campos 'to' e 'text' são obrigatórios" });
    return;
  }

  const runtime = sessions.get(req.params.id);
  if (!runtime?.sock || runtime.status !== "CONNECTED") {
    res.status(409).json({ error: "Sessão de WhatsApp não está conectada" });
    return;
  }

  try {
    const sent = await runtime.sock.sendMessage(to, { text });
    res.json({ externalId: sent?.key?.id ?? null });
  } catch (error) {
    console.error("[wa] erro ao enviar mensagem:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// --------------------------------------------------------------------------
// Bootstrap
// --------------------------------------------------------------------------

/**
 * Reabre sessões que já têm credenciais salvas.
 *
 * Sem isso o usuário precisaria clicar em "Conectar" toda vez que o serviço
 * reiniciasse, mesmo com o número já pareado.
 */
async function restoreSessions(): Promise<void> {
  try {
    const entries = await fs.readdir(SESSIONS_DIR, { withFileTypes: true });
    const sessionIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    for (const sessionId of sessionIds) {
      // Sem creds.json não há pareamento — a pasta é resto de uma tentativa.
      const hasCreds = await fs
        .access(path.join(SESSIONS_DIR, sessionId, "creds.json"))
        .then(() => true)
        .catch(() => false);
      if (!hasCreds) continue;

      console.log(`[wa] restaurando sessão ${sessionId}...`);
      startSession(sessionId).catch((error) =>
        console.error(`[wa] falha ao restaurar ${sessionId}:`, error)
      );
    }
  } catch {
    // Diretório ainda não existe: primeira execução.
  }
}

await fs.mkdir(SESSIONS_DIR, { recursive: true });

const server = createServer(app);

// 0.0.0.0 para o proxy do Railway conseguir alcançar o processo no container.
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n[wa] serviço de WhatsApp ouvindo na porta ${PORT}`);
  console.log(`[wa] sessões em ${SESSIONS_DIR}`);
  console.log(`[wa] webhook configurado para ${WEBHOOK_URL}\n`);
  restoreSessions();
});

// Encerramento limpo: evita deixar sockets pendurados no reload do tsx watch.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log("\n[wa] encerrando...");
    for (const runtime of sessions.values()) {
      runtime.intentionalClose = true;
      try {
        runtime.sock?.end(undefined);
      } catch {
        // ignorado no shutdown
      }
    }
    server.close(() => process.exit(0));
    // Se o close travar, não deixa o processo pendurado.
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
