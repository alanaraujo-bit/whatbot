# Wapply

Plataforma de atendimento e CRM focada exclusivamente em **WhatsApp**. Centraliza conversas,
organiza contatos num funil de vendas e responde perguntas frequentes automaticamente.

**Produção:** https://whatbot-phi.vercel.app
**Login de demonstração:** `admin@wapply.local` / `wapply123`

---

## Índice

- [Arquitetura](#arquitetura)
- [Stack](#stack)
- [Deploy em produção](#deploy-em-produção)
- [Rodando localmente](#rodando-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Modelo de dados](#modelo-de-dados)
- [Trocando o provedor de WhatsApp](#trocando-o-provedor-de-whatsapp)
- [Decisões técnicas](#decisões-técnicas)
- [Troubleshooting](#troubleshooting)
- [Limitações do MVP](#limitações-do-mvp)

---

## Arquitetura

O sistema é dividido em **dois processos**, e essa divisão não é opcional.

```
┌──────────────────────────┐         ┌──────────────────────────────┐
│         VERCEL           │         │          RAILWAY             │
│                          │         │                              │
│  Next.js 15 (App Router) │────────▶│  whatsapp-service (Baileys)  │
│  · UI + API Routes       │  REST   │  · socket persistente        │
│  · NextAuth (sessão JWT) │         │  · volume /data (credenciais)│
│                          │◀────────│                              │
│                          │ webhook │                              │
└───────────┬──────────────┘         └──────────────────────────────┘
            │                                       │
            │            ┌──────────────────────────┘
            ▼            ▼
      ┌──────────────────────┐
      │  PostgreSQL (Railway)│
      └──────────────────────┘
```

**Por que o WhatsApp roda separado?** O Baileys mantém um WebSocket vivo com os servidores
do WhatsApp e guarda chaves de criptografia em disco. Funções serverless são efêmeras e têm
filesystem somente-leitura — o socket morreria a cada invocação e as credenciais se perderiam.
Um processo Node comum com volume persistente resolve os dois problemas.

Toda a comunicação é autenticada pelo header `x-service-token`, compartilhado entre os dois
lados. Sem ele, qualquer um poderia injetar mensagens falsas no CRM através do webhook.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui (Radix), Lucide Icons |
| Backend | Next.js API Routes (Node runtime) |
| Banco | PostgreSQL + Prisma ORM |
| Auth | NextAuth v5 (Auth.js) — credenciais + JWT |
| WhatsApp | Baileys (QR Code), atrás da interface `WhatsAppProvider` |
| PWA | Manifest + Service Worker próprios |

---

## Deploy em produção

O projeto **já está no ar**. Esta seção documenta como foi feito, para reproduzir ou
para entender o que ajustar.

### Vercel (app web)

O projeto está conectado ao repositório GitHub — **todo push na branch `main` dispara
deploy automático**.

```bash
vercel link --yes --project whatbot --scope alan-araujos-projects
vercel deploy --prod
```

> ⚠️ O `vercel.json` na raiz é **obrigatório**. Sem ele o Vercel detecta o `package.json`
> aninhado em `whatsapp-service/` e classifica o repositório como monorepo multi-serviço,
> gerando um rewrite que joga *todo* o tráfego para o micro-serviço — resultando em HTTP 500
> em todas as rotas. O `.vercelignore` complementa, impedindo que a pasta seja empacotada
> como função serverless.

### Railway (banco + micro-serviço)

```bash
railway init --name whatbot
railway add --database postgres

railway add --service whatsapp \
  --variables "WHATSAPP_SERVICE_TOKEN=<token>" \
  --variables "WHATSAPP_SESSIONS_DIR=/data/sessions"

railway service link whatsapp
railway volume add --mount-path /data      # persiste as credenciais do WhatsApp

railway up ./whatsapp-service --path-as-root --service whatsapp
railway domain --service whatsapp
```

> ⚠️ O `--path-as-root` é essencial: sem ele o `railway up` envia a raiz do repositório e
> o build acaba rodando o Next.js em vez do micro-serviço.

### Migrando o banco

O Prisma roda contra a **URL pública** do Postgres (`DATABASE_PUBLIC_URL` no Railway),
já que a interna (`postgres.railway.internal`) só é acessível de dentro da rede deles:

```bash
DATABASE_URL="<DATABASE_PUBLIC_URL>" npx prisma db push
DATABASE_URL="<DATABASE_PUBLIC_URL>" npx tsx prisma/seed.ts
```

### Conectando as duas pontas

Depois do primeiro deploy de cada lado, aponte um para o outro:

| Onde | Variável | Valor |
|---|---|---|
| Vercel | `WHATSAPP_SERVICE_URL` | URL pública do serviço no Railway |
| Railway | `WHATSAPP_WEBHOOK_URL` | `https://<app>.vercel.app/api/whatsapp/webhook` |

O `WHATSAPP_SERVICE_TOKEN` precisa ser **idêntico** nos dois.

---

## Rodando localmente

### Pré-requisitos

- Node.js 20+
- PostgreSQL (ou Docker)

### Passo a passo

```bash
# 1. Dependências (app web e micro-serviço são separados)
npm install
npm install --prefix whatsapp-service

# 2. Banco de dados
docker compose up -d          # Postgres na porta 5433

# 3. Configuração
cp .env.example .env
npx auth secret               # gera AUTH_SECRET
# defina também um WHATSAPP_SERVICE_TOKEN qualquer

# 4. Schema + dados de exemplo
npm run setup                 # prisma generate + db push + seed

# 5. Subir (dois terminais)
npm run dev                   # web  → http://localhost:3000
npm run dev:wa                # WhatsApp → http://localhost:4000
```

Acesse http://localhost:3000 e entre com `admin@wapply.local` / `wapply123`.

### Conectando um número de WhatsApp

1. Vá em **Configurações › WhatsApp**
2. Clique em **Conectar WhatsApp**
3. No celular: WhatsApp → **Aparelhos conectados** → **Conectar um aparelho**
4. Aponte a câmera para o QR Code

O status muda para *Conectado* sozinho e as conversas começam a aparecer.

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|:---:|---|
| `DATABASE_URL` | ✅ | String de conexão do PostgreSQL |
| `AUTH_SECRET` | ✅ | Segredo de assinatura do JWT (`npx auth secret`) |
| `AUTH_URL` | | URL canônica do app. Em produção, evita ambiguidade de host |
| `AUTH_TRUST_HOST` | | `true` em plataformas com proxy (Vercel) |
| `WHATSAPP_PROVIDER` | | `baileys` (padrão) ou `cloud` |
| `WHATSAPP_SERVICE_URL` | ✅ | Onde o Next.js encontra o micro-serviço |
| `WHATSAPP_WEBHOOK_URL` | ✅ | Onde o micro-serviço entrega eventos |
| `WHATSAPP_SERVICE_TOKEN` | ✅ | Token compartilhado — **idêntico nos dois lados** |
| `WHATSAPP_SESSIONS_DIR` | | Onde salvar credenciais. **Aponte para um volume em produção** |
| `NEXT_PUBLIC_APP_NAME` | | Nome exibido na interface |

Veja `.env.example` para o arquivo completo comentado.

---

## Estrutura do projeto

```
├── prisma/
│   ├── schema.prisma          # models e enums
│   └── seed.ts                # workspace demo, tags, automações
├── public/
│   ├── manifest.webmanifest   # PWA
│   ├── sw.js                  # service worker
│   └── icons/                 # gerados por scripts/generate-icons.mjs
├── scripts/
│   └── generate-icons.mjs     # codificador PNG próprio, sem dependências
├── src/
│   ├── app/
│   │   ├── (auth)/            # login, cadastro
│   │   ├── (app)/             # dashboard autenticado
│   │   └── api/               # rotas REST
│   ├── components/
│   │   ├── conversations/     # as 3 colunas do chat
│   │   ├── contacts/  crm/  automations/  settings/
│   │   ├── layout/            # sidebar, tab bar mobile
│   │   └── ui/                # shadcn/ui
│   ├── lib/                   # utilitários puros e validações Zod
│   ├── server/                # regras de negócio (só servidor)
│   │   ├── messaging.ts       # ÚNICO lugar que escreve mensagens
│   │   ├── automations.ts     # motor de regras
│   │   ├── events.ts          # barramento SSE
│   │   └── whatsapp/          # a abstração de provedor
│   ├── auth.ts / auth.config.ts
│   └── middleware.ts          # proteção de rotas
└── whatsapp-service/          # ← deploy independente (Railway)
    └── index.ts               # Baileys + API REST + webhook
```

---

## Modelo de dados

Multi-tenant: **tudo pendura em `Workspace`**. Um workspace = uma empresa.

```
Workspace ─┬─ User ──────────── Account (OAuth, preparado para Google/Apple)
           ├─ WhatsappSession   (o número conectado)
           ├─ Contact ─┬─ Tag   (N:N)
           │           ├─ Note  (notas internas)
           │           └─ Conversation ── Message
           └─ Automation
```

Detalhes que valem notar:

- `Contact` tem índice único em `(workspaceId, phone)` — a primeira mensagem de um número
  desconhecido cria o contato automaticamente, sem duplicar.
- `Message` tem índice único em `(workspaceId, externalId)` — o WhatsApp reentrega eventos
  com frequência, e isso torna a ingestão idempotente.
- `Conversation` guarda `lastMessagePreview` e `lastMessageAt` desnormalizados, para a lista
  de conversas não precisar de JOIN com mensagens a cada render.

---

## Trocando o provedor de WhatsApp

Toda a aplicação fala com o WhatsApp por uma única interface:

```ts
interface WhatsAppProvider {
  connect(sessionId): Promise<ProviderSessionState>;
  getStatus(sessionId): Promise<ProviderSessionState>;
  disconnect(sessionId): Promise<void>;
  logout(sessionId): Promise<void>;
  sendText(sessionId, to, text): Promise<SendTextResult>;
}
```

Existem duas implementações:

| Provider | Arquivo | Estado |
|---|---|---|
| Baileys (QR Code, não oficial) | `src/server/whatsapp/baileys-provider.ts` | ✅ em uso |
| Meta Cloud API (oficial) | `src/server/whatsapp/cloud-provider.ts` | 🚧 esqueleto |

Para migrar para a API oficial: preencha `META_PHONE_NUMBER_ID` e `META_ACCESS_TOKEN`,
complete o `sendText`, traduza o payload do webhook da Meta para o tipo `WebhookEvent`,
e defina `WHATSAPP_PROVIDER="cloud"`. **Nenhum outro arquivo muda.**

---

## Decisões técnicas

**Micro-serviço separado para o Baileys.** Explicado em [Arquitetura](#arquitetura). É a
decisão estrutural mais importante do projeto.

**Polling em vez de SSE em produção.** Existe um endpoint SSE (`/api/events`) alimentado por
um `EventEmitter` em processo. Ele funciona perfeitamente em dev e self-host, mas em serverless
o webhook chega numa instância e o stream vive em outra — o evento nunca cruza. Por isso o
**polling do SWR é o caminho principal** (3s no chat aberto, 5s na lista) e o SSE apenas
antecipa o refresh quando disponível. Ao escalar, troque o `publish`/`subscribe` de
`src/server/events.ts` por Redis pub/sub — a assinatura das funções não muda.

**Só a primeira automação que casar dispara.** Regras são avaliadas por prioridade crescente
e a busca para no primeiro match. Sem isso, uma mensagem com "preço" e "horário" geraria duas
respostas automáticas seguidas.

**Drag & drop nativo no CRM, com alternativa por menu.** A HTML5 Drag and Drop API evita uma
dependência, mas não funciona em toque. Cada card também tem um menu "Mover para", então a
funcionalidade nunca fica inacessível no mobile.

**Ícones gerados por script.** `scripts/generate-icons.mjs` rasteriza o balão de conversa e
codifica o PNG na mão (zlib + CRC32 nativos), em vez de adicionar `sharp` ou `canvas` ao
projeto só para produzir três arquivos.

**Mensagem gravada como `PENDING` antes do envio.** Se o WhatsApp falhar, ela aparece no chat
marcada como falha em vez de sumir — o atendente vê o que aconteceu.

---

## Troubleshooting

**Status do WhatsApp não sai de "Desconectado"**
Confirme que o micro-serviço está no ar: `curl https://<servico>/health`. Verifique se
`WHATSAPP_SERVICE_URL` (no app) e `WHATSAPP_SERVICE_TOKEN` (nos dois lados) estão corretos.

**QR Code aparece mas nunca conecta**
O código expira em ~60s e é renovado automaticamente. Se persistir, use *Desvincular número*
para limpar as credenciais e comece de novo.

**Precisa ler o QR Code a cada deploy**
`WHATSAPP_SESSIONS_DIR` não está apontando para um volume persistente. No Railway, monte um
volume e defina a variável para um caminho dentro dele (ex.: `/data/sessions`).

**Todas as rotas do Vercel retornam 500**
Provavelmente o `vercel.json` foi sobrescrito pela autodetecção de monorepo. Confirme que ele
contém `"framework": "nextjs"` e **não** um bloco `services` com `rewrites`.

**`prisma db push` não conecta**
Use a `DATABASE_PUBLIC_URL` do Railway. A `DATABASE_URL` interna só resolve de dentro da
rede privada deles.

---

## Limitações do MVP

Coisas que ficaram deliberadamente de fora, e por quê:

- **Só texto.** Mídias recebidas aparecem como marcador legível ("📷 Imagem"), mas não há
  upload nem download. Exige storage de objetos e um fluxo de anexos completo.
- **Um número por workspace.** O schema já suporta vários (`WhatsappSession` é uma lista),
  mas a UI assume um só.
- **Grupos ignorados.** Atendimento em grupo tem regras de negócio próprias.
- **Sem gestão de equipe.** O model `User` tem `role` (OWNER/ADMIN/AGENT) e conversas têm
  `assignedTo`, mas não existe tela para convidar usuários ou distribuir atendimentos.
- **Baileys é não oficial.** Números conectados de IPs de datacenter podem ser sinalizados
  pelo WhatsApp com mais rigor. Para produção séria, migre para a Cloud API oficial — a
  arquitetura já está pronta.
