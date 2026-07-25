"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Settings, User as UserIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials, stringToColor } from "@/lib/utils";

type MenuUser = {
  name?: string | null;
  email?: string | null;
  workspaceName?: string;
};

export function UserMenu({ user }: { user: MenuUser }) {
  const name = user.name ?? "Usuário";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="mt-1 rounded-full outline-none ring-offset-background transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Menu do usuário"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback
              style={{ backgroundColor: stringToColor(name), color: "#fff" }}
              className="text-[11px]"
            >
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-0.5">
            <span className="text-sm font-medium text-foreground">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            {user.workspaceName && (
              <span className="pt-1 text-2xs uppercase tracking-wide text-muted-foreground">
                {user.workspaceName}
              </span>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <UserIcon className="h-4 w-4" />
            Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
