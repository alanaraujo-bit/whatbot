/**
 * Seed do Wapply.
 *
 * Cria um workspace de demonstração com usuário, tags, automações e alguns
 * contatos/conversas para que o dashboard não abra vazio.
 *
 * Idempotente: pode rodar quantas vezes quiser (usa upsert nas chaves naturais).
 *
 *   npm run db:seed
 */
import { PrismaClient, CrmStage, AutomationTrigger, UserRole, MessageDirection } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "admin@wapply.local";
const DEMO_PASSWORD = "wapply123";

async function main() {
  console.log("🌱 Semeando o banco do Wapply...\n");

  // --- Workspace -------------------------------------------------------
  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Minha Empresa", slug: "demo" },
  });
  console.log(`  ✓ Workspace: ${workspace.name}`);

  // --- Usuário owner ---------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: {
      name: "Administrador",
      email: DEMO_EMAIL,
      passwordHash,
      role: UserRole.OWNER,
      workspaceId: workspace.id,
    },
  });
  console.log(`  ✓ Usuário: ${user.email}`);

  // --- Sessão do WhatsApp (placeholder, desconectada) ------------------
  const existingSession = await prisma.whatsappSession.findFirst({
    where: { workspaceId: workspace.id },
  });
  if (!existingSession) {
    await prisma.whatsappSession.create({
      data: { name: "Número principal", workspaceId: workspace.id },
    });
    console.log("  ✓ Sessão de WhatsApp criada (desconectada)");
  }

  // --- Tags ------------------------------------------------------------
  const tagSeeds = [
    { name: "Novo cliente", color: "#22c55e" },
    { name: "Orçamento", color: "#3b82f6" },
    { name: "Pagamento pendente", color: "#f59e0b" },
    { name: "Cliente VIP", color: "#a855f7" },
    { name: "Suporte", color: "#06b6d4" },
  ];

  const tags = [];
  for (const t of tagSeeds) {
    tags.push(
      await prisma.tag.upsert({
        where: { workspaceId_name: { workspaceId: workspace.id, name: t.name } },
        update: { color: t.color },
        create: { ...t, workspaceId: workspace.id },
      })
    );
  }
  console.log(`  ✓ ${tags.length} etiquetas`);

  // --- Automações ------------------------------------------------------
  const automationSeeds = [
    {
      name: "Resposta sobre preços",
      trigger: AutomationTrigger.CONTAINS,
      keyword: "preço",
      response: "Olá! Vou te ajudar com informações sobre nossos preços. 💰",
      priority: 0,
    },
    {
      name: "Horário de atendimento",
      trigger: AutomationTrigger.CONTAINS,
      keyword: "horário",
      response: "Nosso atendimento funciona de segunda a sexta, das 9h às 18h.",
      priority: 1,
    },
    {
      name: "Boas-vindas",
      trigger: AutomationTrigger.ANY_MESSAGE,
      keyword: null,
      response: "Olá! 👋 Recebemos sua mensagem e um atendente responderá em instantes.",
      priority: 99,
      onlyFirstMessage: true,
    },
  ];

  for (const a of automationSeeds) {
    const exists = await prisma.automation.findFirst({
      where: { workspaceId: workspace.id, name: a.name },
    });
    if (!exists) {
      await prisma.automation.create({ data: { ...a, workspaceId: workspace.id } });
    }
  }
  console.log(`  ✓ ${automationSeeds.length} automações`);

  // --- Contatos + conversas de exemplo ---------------------------------
  const demoContacts = [
    {
      name: "Mariana Costa",
      phone: "5511988887777",
      email: "mariana@exemplo.com",
      stage: CrmStage.NEGOTIATION,
      tagNames: ["Orçamento", "Cliente VIP"],
      messages: [
        { direction: MessageDirection.INBOUND, content: "Oi, boa tarde!" },
        { direction: MessageDirection.INBOUND, content: "Queria saber o preço do plano anual" },
        {
          direction: MessageDirection.OUTBOUND,
          content: "Olá Mariana! O plano anual sai por R$ 1.990 com 2 meses grátis.",
        },
      ],
    },
    {
      name: "Ricardo Almeida",
      phone: "5521977776666",
      email: null,
      stage: CrmStage.NEW_LEAD,
      tagNames: ["Novo cliente"],
      messages: [
        { direction: MessageDirection.INBOUND, content: "Vocês entregam em Niterói?" },
      ],
    },
    {
      name: "Fernanda Lima",
      phone: "5531966665555",
      email: "fernanda@exemplo.com",
      stage: CrmStage.CONTACTED,
      tagNames: ["Suporte"],
      messages: [
        { direction: MessageDirection.INBOUND, content: "Minha fatura não chegou este mês" },
        { direction: MessageDirection.OUTBOUND, content: "Vou verificar aqui pra você, um instante!" },
      ],
    },
    {
      name: "Paulo Nogueira",
      phone: "5541955554444",
      email: null,
      stage: CrmStage.WON,
      tagNames: ["Cliente VIP"],
      messages: [{ direction: MessageDirection.OUTBOUND, content: "Contrato assinado, obrigado Paulo!" }],
    },
    {
      name: "Juliana Reis",
      phone: "5551944443333",
      email: null,
      stage: CrmStage.NEW_LEAD,
      tagNames: ["Pagamento pendente"],
      messages: [{ direction: MessageDirection.INBOUND, content: "Consigo parcelar em 3x?" }],
    },
  ];

  let seq = 0;
  for (const c of demoContacts) {
    const contact = await prisma.contact.upsert({
      where: { workspaceId_phone: { workspaceId: workspace.id, phone: c.phone } },
      update: {},
      create: {
        name: c.name,
        phone: c.phone,
        email: c.email,
        stage: c.stage,
        stageRank: seq,
        workspaceId: workspace.id,
        tags: {
          connect: tags.filter((t) => c.tagNames.includes(t.name)).map((t) => ({ id: t.id })),
        },
      },
    });

    const remoteJid = `${c.phone}@s.whatsapp.net`;
    const last = c.messages[c.messages.length - 1];
    // Espalha as conversas ao longo das últimas horas para a lista ficar realista.
    const lastAt = new Date(Date.now() - seq * 47 * 60 * 1000);

    const conversation = await prisma.conversation.upsert({
      where: { workspaceId_remoteJid: { workspaceId: workspace.id, remoteJid } },
      update: {},
      create: {
        remoteJid,
        workspaceId: workspace.id,
        contactId: contact.id,
        lastMessagePreview: last.content,
        lastMessageAt: lastAt,
        unreadCount: last.direction === MessageDirection.INBOUND ? 1 : 0,
      },
    });

    const alreadyHasMessages = await prisma.message.count({
      where: { conversationId: conversation.id },
    });
    if (alreadyHasMessages === 0) {
      for (const [i, m] of c.messages.entries()) {
        await prisma.message.create({
          data: {
            direction: m.direction,
            content: m.content,
            workspaceId: workspace.id,
            conversationId: conversation.id,
            sentById: m.direction === MessageDirection.OUTBOUND ? user.id : null,
            timestamp: new Date(lastAt.getTime() - (c.messages.length - 1 - i) * 60 * 1000),
          },
        });
      }
    }
    seq++;
  }
  console.log(`  ✓ ${demoContacts.length} contatos com conversas de exemplo`);

  console.log("\n✅ Seed concluído!\n");
  console.log("   Acesse http://localhost:3000 e entre com:");
  console.log(`   E-mail:  ${DEMO_EMAIL}`);
  console.log(`   Senha:   ${DEMO_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
