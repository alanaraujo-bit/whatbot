"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { TagPicker } from "@/components/contacts/tag-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { CRM_STAGES } from "@/lib/crm";
import { apiRequest, HttpError } from "@/lib/fetcher";
import { contactSchema, type ContactInput } from "@/lib/validations";
import type { ContactListItem, TagWithCount } from "@/types";

/** Formulário de criação/edição de contato. Um só componente para os dois modos. */
export function ContactDialog({
  open,
  contact,
  allTags,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  contact: ContactListItem | null;
  allTags: TagWithCount[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEditing = contact !== null;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      company: "",
      notes: "",
      stage: "NEW_LEAD",
      tagIds: [],
    },
  });

  // Repopula o formulário toda vez que abre (ou troca o contato editado).
  useEffect(() => {
    if (!open) return;

    reset({
      name: contact?.name ?? "",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      company: contact?.company ?? "",
      notes: contact?.notes ?? "",
      stage: contact?.stage ?? "NEW_LEAD",
      tagIds: contact?.tags.map((t) => t.id) ?? [],
    });
  }, [open, contact, reset]);

  async function onSubmit(values: ContactInput) {
    try {
      await apiRequest(isEditing ? `/api/contacts/${contact.id}` : "/api/contacts", {
        method: isEditing ? "PATCH" : "POST",
        body: values,
      });

      toast.success(isEditing ? "Contato atualizado" : "Contato criado");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof HttpError && error.fields) {
        for (const [field, message] of Object.entries(error.fields)) {
          setError(field as keyof ContactInput, { message });
        }
        return;
      }
      toast.error((error as Error).message);
    }
  }

  const tagIds = watch("tagIds") ?? [];
  const stage = watch("stage") ?? "NEW_LEAD";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar contato" : "Novo contato"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados e a etapa do funil."
              : "Cadastre um contato para começar a acompanhar no CRM."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" placeholder="Maria Silva" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone *</Label>
            <Input id="phone" placeholder="(11) 98888-7777" {...register("phone")} />
            <p className="text-[10px] text-muted-foreground">
              Sem DDI, assumimos +55 (Brasil).
            </p>
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="maria@..." {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company">Empresa</Label>
              <Input id="company" placeholder="Acme Ltda" {...register("company")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Etapa do funil</Label>
            <Select
              value={stage}
              onValueChange={(value) => setValue("stage", value as ContactInput["stage"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRM_STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Etiquetas</Label>
            <TagPicker
              allTags={allTags}
              selectedIds={tagIds}
              onChange={(ids) => setValue("tagIds", ids)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" placeholder="Anotações rápidas..." {...register("notes")} />
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar" : "Criar contato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
