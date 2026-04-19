"use client";

import { Search, Moon, Sun, LogOut, User } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUIStore } from "@/store/ui";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function Topbar() {
  const { setCommandPaletteOpen } = useUIStore();
  const { setTheme, theme } = useTheme();
  const router = useRouter();
  const { user, orgId, clear } = useAuthStore();

  const initials = user?.name
    ? user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  useKeyboardShortcut("k", () => setCommandPaletteOpen(true), { meta: true, ctrl: true });

  const onLogout = () => {
    clear();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex flex-1 max-w-md items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="h-4 w-4" />
        <span>Buscar...</span>
        <kbd className="ml-auto hidden rounded bg-background px-1.5 py-0.5 text-[10px] font-mono md:inline">
          Ctrl+K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted">
              <Avatar className="h-7 w-7">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-tight">{user?.name ?? "Usuário"}</p>
                {user?.email && (
                  <p className="text-[11px] text-muted-foreground leading-tight">{user.email}</p>
                )}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/configuracoes")}>
              <User className="h-4 w-4" /> Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onLogout} className="text-destructive">
              <LogOut className="h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
