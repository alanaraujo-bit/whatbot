import { Bot, Contact, KanbanSquare, MessagesSquare, Settings, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece na barra inferior do mobile. */
  mobile: boolean;
};

/** Fonte única da navegação — usada pela sidebar (desktop) e pela tab bar (mobile). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/conversations", label: "Conversas", icon: MessagesSquare, mobile: true },
  { href: "/contacts", label: "Contatos", icon: Contact, mobile: true },
  { href: "/crm", label: "CRM", icon: KanbanSquare, mobile: true },
  { href: "/automations", label: "Automações", icon: Bot, mobile: true },
  { href: "/settings", label: "Configurações", icon: Settings, mobile: true },
];

/** True quando o item corresponde à rota atual (inclui sub-rotas). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
