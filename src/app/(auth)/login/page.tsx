import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Bem-vindo de volta</h1>
        <p className="text-sm text-muted-foreground">Entre para acessar seus atendimentos</p>
      </div>

      {/* LoginForm lê searchParams (callbackUrl), então precisa de fronteira de Suspense. */}
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
        <LoginForm />
      </Suspense>

      <p className="text-center text-sm text-muted-foreground">
        Não tem uma conta?{" "}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
