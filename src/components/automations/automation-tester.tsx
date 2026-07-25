"use client";

import { useState } from "react";
import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { matchesTrigger, type TriggerKind } from "@/lib/automation-matching";
import { cn } from "@/lib/utils";

/**
 * Testador ao vivo da regra.
 *
 * Existe porque o usuário não tem como saber, olhando o formulário, se a
 * combinação que montou algum dia vai disparar. Aqui ele digita uma mensagem
 * de exemplo e vê a resposta na hora — usando a MESMA função do motor real.
 */
export function AutomationTester({
  trigger,
  keyword,
  response,
  onlyFirstMessage,
}: {
  trigger: TriggerKind;
  keyword: string;
  response: string;
  onlyFirstMessage: boolean;
}) {
  const [sample, setSample] = useState("");
  // O motor só habilita regras de boas-vindas na primeira mensagem da conversa.
  const [simulateFirst, setSimulateFirst] = useState(true);

  const trimmed = sample.trim();
  const blockedByFirstRule = onlyFirstMessage && !simulateFirst;
  const wouldFire = trimmed.length > 0 && !blockedByFirstRule && matchesTrigger(trigger, keyword, sample);

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5">
        <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-xs">Testar a regra</Label>
      </div>

      <Input
        value={sample}
        onChange={(e) => setSample(e.target.value)}
        placeholder="Digite uma mensagem como o cliente escreveria..."
        className="h-8 text-xs"
      />

      {onlyFirstMessage && (
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <span className="text-[11px] text-muted-foreground">
            Simular como primeira mensagem da conversa
          </span>
          <Switch checked={simulateFirst} onCheckedChange={setSimulateFirst} />
        </div>
      )}

      {trimmed.length > 0 && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md px-2.5 py-2 text-xs",
            wouldFire
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {wouldFire ? (
            <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />
          ) : (
            <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          )}

          <div className="min-w-0">
            {wouldFire ? (
              <>
                <p className="font-medium">A regra dispara e responde:</p>
                <p className="mt-1 whitespace-pre-wrap break-words rounded bg-background/60 px-2 py-1 text-foreground">
                  {response.trim() || "(defina a resposta acima)"}
                </p>
              </>
            ) : (
              <p className="font-medium">
                {blockedByFirstRule
                  ? "Não dispara: a regra está limitada à primeira mensagem da conversa."
                  : "Não dispara para esta mensagem."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
