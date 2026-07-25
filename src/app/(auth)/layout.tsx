import { MessageCircleMore } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Wapply";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageCircleMore className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="pb-6 text-center text-xs text-muted-foreground">
        Atendimento e CRM para WhatsApp
      </footer>
    </div>
  );
}
