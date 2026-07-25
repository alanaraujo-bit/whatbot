import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { NotificationWatcher } from "@/components/layout/notification-watcher";

/**
 * Shell autenticado.
 *
 * Desktop: sidebar fixa de 60px + conteúdo.
 * Mobile: conteúdo em tela cheia + tab bar inferior.
 *
 * A altura é travada em 100dvh e o scroll acontece dentro dos painéis —
 * é o que faz o layout de 3 colunas do chat se comportar como app nativo.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Cinto de segurança: o middleware já barra, mas as páginas dependem de session.user.
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <AppSidebar user={session.user} />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-hidden pb-14 md:pb-0">{children}</main>
        <MobileTabBar />
      </div>

      {/* Som e notificação de mensagem nova, em qualquer página do app. */}
      <NotificationWatcher />
    </div>
  );
}
