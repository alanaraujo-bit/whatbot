"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircleMore } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_ITEMS, isActivePath } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SidebarUser = {
  name?: string | null;
  email?: string | null;
  workspaceName?: string;
};

/**
 * Sidebar compacta (só ícones), estilo Linear/Slack.
 * Escondida no mobile — lá a navegação é a tab bar inferior.
 */
export function AppSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[60px] shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-3 md:flex">
      <Link
        href="/conversations"
        className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform hover:scale-105"
        aria-label="Wapply"
      >
        <MessageCircleMore className="h-4 w-4" />
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    active
                      ? "bg-sidebar-accent text-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  {active && (
                    <span className="absolute -left-3 h-5 w-1 rounded-r-full bg-primary" />
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-1">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </aside>
  );
}
