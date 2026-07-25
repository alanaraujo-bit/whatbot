"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/fetcher";

export function ProfileSettings() {
  const { data: session, update } = useSession();

  const [name, setName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // A sessão chega de forma assíncrona; sincroniza o campo quando ela carrega.
  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session?.user?.name]);

  async function saveName() {
    setIsSavingName(true);
    try {
      await apiRequest("/api/profile", { method: "PATCH", body: { name } });
      // Propaga para o JWT para o menu do usuário atualizar sem novo login.
      await update({ name });
      toast.success("Perfil atualizado");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSavingName(false);
    }
  }

  async function savePassword() {
    setIsSavingPassword(true);
    try {
      await apiRequest("/api/profile", {
        method: "PUT",
        body: { currentPassword, newPassword, confirmPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Meus dados</CardTitle>
          <CardDescription className="text-xs">
            {session?.user?.email} · {session?.user?.workspaceName}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <Button size="sm" onClick={saveName} disabled={isSavingName || name.trim().length < 2}>
            {isSavingName && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Alterar senha</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current">Senha atual</Label>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new">Nova senha</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <Button
            size="sm"
            onClick={savePassword}
            disabled={
              isSavingPassword || !currentPassword || newPassword.length < 8 || !confirmPassword
            }
          >
            {isSavingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Alterar senha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
