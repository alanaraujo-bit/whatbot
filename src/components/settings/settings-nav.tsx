"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings", label: "WhatsApp" },
  { href: "/settings/tags", label: "Etiquetas" },
  { href: "/settings/profile", label: "Perfil" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <header className="shrink-0 border-b border-border px-3 pt-3 md:px-4">
      <h1 className="text-sm font-semibold tracking-tight">Configurações</h1>

      <nav className="mt-2.5 flex gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative px-2.5 py-2 text-xs font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {active && (
                <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
