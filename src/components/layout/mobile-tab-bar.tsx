"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS, isActivePath } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Navegação inferior do mobile.
 *
 * Fica oculta dentro de uma conversa aberta (`/conversations/[id]`) para o
 * chat ocupar a tela inteira, como num app de mensagens nativo.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const insideConversation = /^\/conversations\/[^/]+$/.test(pathname);

  if (insideConversation) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-border bg-background/95 backdrop-blur md:hidden">
      {NAV_ITEMS.filter((i) => i.mobile).map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
