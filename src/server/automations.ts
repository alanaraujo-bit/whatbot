import type { Automation } from "@prisma/client";

import { matchesTrigger } from "@/lib/automation-matching";
import { prisma } from "@/lib/prisma";

/**
 * Motor de automações.
 *
 * Regras são avaliadas por `priority` crescente e SOMENTE A PRIMEIRA que casar
 * dispara — evita que o cliente receba três respostas automáticas seguidas.
 *
 * Extensão para IA: quando quiser respostas geradas por modelo, acrescente um
 * `AutomationTrigger.AI` e, em vez de devolver `automation.response` pronto,
 * chame o modelo aqui passando o histórico da conversa como contexto. O resto
 * do fluxo (persistir, enviar, publicar evento) continua igual.
 */

/**
 * Encontra a automação que deve responder a uma mensagem recebida.
 *
 * @param isFirstMessage true quando é a primeira mensagem da conversa —
 *   habilita as regras marcadas como `onlyFirstMessage` (boas-vindas).
 * @returns a automação vencedora, ou null se nenhuma casar.
 */
export async function findMatchingAutomation(
  workspaceId: string,
  message: string,
  isFirstMessage: boolean
): Promise<Automation | null> {
  const automations = await prisma.automation.findMany({
    where: { workspaceId, isActive: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  for (const automation of automations) {
    if (automation.onlyFirstMessage && !isFirstMessage) continue;
    if (matchesTrigger(automation.trigger, automation.keyword, message)) {
      return automation;
    }
  }

  return null;
}

/** Contabiliza o disparo, para a UI mostrar quais regras realmente funcionam. */
export async function recordAutomationTrigger(automationId: string): Promise<void> {
  await prisma.automation.update({
    where: { id: automationId },
    data: {
      triggerCount: { increment: 1 },
      lastTriggeredAt: new Date(),
    },
  });
}
