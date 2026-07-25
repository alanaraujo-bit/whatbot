"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AUTOMATION_TRIGGER_LABELS } from "@/lib/crm";
import { apiRequest, HttpError } from "@/lib/fetcher";
import { automationSchema, type AutomationInput } from "@/lib/validations";
import type { AutomationItem } from "@/types";

export function AutomationDialog({
  open,
  automation,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  automation: AutomationItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEditing = automation !== null;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AutomationInput>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: "",
      trigger: "CONTAINS",
      keyword: "",
      response: "",
      isActive: true,
      priority: 0,
      onlyFirstMessage: false,
    },
  });

  useEffect(() => {
    if (!open) return;

    reset({
      name: automation?.name ?? "",
      trigger: automation?.trigger ?? "CONTAINS",
      keyword: automation?.keyword ?? "",
      response: automation?.response ?? "",
      isActive: automation?.isActive ?? true,
      priority: automation?.priority ?? 0,
      onlyFirstMessage: automation?.onlyFirstMessage ?? false,
    });
  }, [open, automation, reset]);

  const trigger = watch("trigger");
  const onlyFirstMessage = watch("onlyFirstMessage");
  const needsKeyword = trigger !== "ANY_MESSAGE";

  async function onSubmit(values: AutomationInput) {
    try {
      await apiRequest(isEditing ? `/api/automations/${automation.id}` : "/api/automations", {
        method: isEditing ? "PATCH" : "POST",
        body: values,
      });

      toast.success(isEditing ? "Automação atualizada" : "Automação criada");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof HttpError && error.fields) {
        for (const [field, message] of Object.entries(error.fields)) {
          setError(field as keyof AutomationInput, { message });
        }
        return;
      }
      toast.error((error as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar automação" : "Nova automação"}</DialogTitle>
          <DialogDescription>
            Responda automaticamente quando a mensagem do cliente casar com a regra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome da regra *</Label>
            <Input id="name" placeholder="Resposta sobre preços" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Gatilho</Label>
              <Select
                value={trigger}
                onValueChange={(value) => setValue("trigger", value as AutomationInput["trigger"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AUTOMATION_TRIGGER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="priority">Prioridade</Label>
              <Input
                id="priority"
                type="number"
                min={0}
                max={999}
                {...register("priority", { valueAsNumber: true })}
              />
              <p className="text-[10px] text-muted-foreground">Menor = avaliada antes</p>
            </div>
          </div>

          {needsKeyword && (
            <div className="space-y-1.5">
              <Label htmlFor="keyword">Palavra-chave *</Label>
              <Input id="keyword" placeholder="preço" {...register("keyword")} />
              <p className="text-[10px] text-muted-foreground">
                Não diferencia maiúsculas nem acentos: &quot;Preço&quot; e &quot;preco&quot; casam
                igual.
              </p>
              {errors.keyword && (
                <p className="text-xs text-destructive">{errors.keyword.message}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="response">Resposta automática *</Label>
            <Textarea
              id="response"
              placeholder="Olá! Vou te ajudar com informações sobre nossos preços."
              className="min-h-[90px]"
              {...register("response")}
            />
            {errors.response && (
              <p className="text-xs text-destructive">{errors.response.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-2.5">
            <div className="pr-3">
              <p className="text-xs font-medium">Apenas na primeira mensagem</p>
              <p className="text-[10px] text-muted-foreground">
                Ideal para mensagens de boas-vindas.
              </p>
            </div>
            <Switch
              checked={onlyFirstMessage}
              onCheckedChange={(checked) => setValue("onlyFirstMessage", checked)}
            />
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar" : "Criar automação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
