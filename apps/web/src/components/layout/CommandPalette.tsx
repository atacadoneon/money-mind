"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { useUIStore } from "@/store/ui";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/store/auth";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  LayoutDashboard,
  Users,
  GitMerge,
  FileSpreadsheet,
  Plus,
  Moon,
  Sun,
  LogOut,
  Settings,
  BarChart3,
  Building2,
  Wallet,
  CreditCard,
  History,
  HelpCircle,
  Bug
} from "lucide-react";

const RECENT_ACTIONS_KEY = "mm:recent-actions";
const MAX_RECENT = 5;

interface RecentAction {
  label: string;
  href?: string;
  ts: number;
}

function useRecentActions() {
  const [recent, setRecent] = React.useState<RecentAction[]>([]);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_ACTIONS_KEY);
      if (stored) setRecent(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const addRecent = React.useCallback((action: Omit<RecentAction, "ts">) => {
    setRecent((prev) => {
      const filtered = prev.filter((a) => a.label !== action.label);
      const updated = [{ ...action, ts: Date.now() }, ...filtered].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_ACTIONS_KEY, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  }, []);

  return { recent, addRecent };
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { setTheme, theme } = useTheme();
  const { clear } = useAuthStore();
  const router = useRouter();
  const { recent, addRecent } = useRecentActions();

  const go = (href: string, label: string) => {
    setCommandPaletteOpen(false);
    addRecent({ label, href });
    router.push(href);
  };

  const action = (fn: () => void, label: string) => {
    setCommandPaletteOpen(false);
    addRecent({ label });
    fn();
  };

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <CommandInput placeholder="Buscar páginas e ações..." />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        {/* Recentes */}
        {recent.length > 0 && (
          <>
            <CommandGroup heading="Recentes">
              {recent.map((r) => (
                <CommandItem
                  key={r.label}
                  onSelect={() => r.href ? go(r.href, r.label) : undefined}
                >
                  <History className="h-4 w-4 text-muted-foreground" />
                  {r.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Ações rápidas */}
        <CommandGroup heading="Ações">
          <CommandItem onSelect={() => go("/financas/contas-a-pagar?novo=1", "Nova conta a pagar")}>
            <Plus className="h-4 w-4" /> Nova conta a pagar
          </CommandItem>
          <CommandItem onSelect={() => go("/financas/contas-a-receber?novo=1", "Nova conta a receber")}>
            <Plus className="h-4 w-4" /> Nova conta a receber
          </CommandItem>
          <CommandItem onSelect={() => go("/cadastros/clientes-fornecedores?novo=1", "Novo contato")}>
            <Plus className="h-4 w-4" /> Novo contato
          </CommandItem>
          <CommandItem
            onSelect={() =>
              action(
                () => setTheme(theme === "dark" ? "light" : "dark"),
                theme === "dark" ? "Modo claro" : "Modo escuro"
              )
            }
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          </CommandItem>
          <CommandItem
            onSelect={() =>
              action(() => {
                clear();
                router.push("/login");
              }, "Sair")
            }
            className="text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sair da conta
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navegação */}
        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => go("/inicio", "Dashboard")}>
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/financas/contas-a-pagar", "Contas a pagar")}>
            <ArrowUpCircle className="h-4 w-4" /> Contas a pagar
          </CommandItem>
          <CommandItem onSelect={() => go("/financas/contas-a-receber", "Contas a receber")}>
            <ArrowDownCircle className="h-4 w-4" /> Contas a receber
          </CommandItem>
          <CommandItem onSelect={() => go("/financas/caixa", "Caixa")}>
            <Wallet className="h-4 w-4" /> Caixa
          </CommandItem>
          <CommandItem onSelect={() => go("/financas/conciliacao", "Conciliação")}>
            <GitMerge className="h-4 w-4" /> Conciliação bancária
          </CommandItem>
          <CommandItem onSelect={() => go("/financas/extratos-bancarios", "Extratos bancários")}>
            <FileSpreadsheet className="h-4 w-4" /> Extratos bancários
          </CommandItem>
          <CommandItem onSelect={() => go("/financas/relatorios", "Relatórios")}>
            <BarChart3 className="h-4 w-4" /> Relatórios
          </CommandItem>
          <CommandItem onSelect={() => go("/financas/conta-digital", "Conta digital")}>
            <CreditCard className="h-4 w-4" /> Conta digital
          </CommandItem>
          <CommandItem onSelect={() => go("/cadastros/clientes-fornecedores", "Clientes e Fornecedores")}>
            <Users className="h-4 w-4" /> Clientes / Fornecedores
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Empresa e configurações */}
        <CommandGroup heading="Empresa e ajuda">
          <CommandItem onSelect={() => go("/configuracoes", "Configurações")}>
            <Settings className="h-4 w-4" /> Configurações
          </CommandItem>
          <CommandItem onSelect={() => go("/configuracoes/empresas", "Gerenciar empresas")}>
            <Building2 className="h-4 w-4" /> Gerenciar empresas
          </CommandItem>
          <CommandItem
            onSelect={() =>
              action(() => window.open("mailto:suporte@moneymind.app?subject=Bug%20Report", "_blank"), "Reportar bug")
            }
          >
            <Bug className="h-4 w-4" /> Reportar bug
          </CommandItem>
          <CommandItem
            onSelect={() =>
              action(() => window.open("https://docs.moneymind.app", "_blank"), "Abrir documentação")
            }
          >
            <HelpCircle className="h-4 w-4" /> Documentação
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
