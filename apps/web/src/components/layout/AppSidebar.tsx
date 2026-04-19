"use client";

import {
  LayoutDashboard,
  Users,
  Tag,
  CreditCard,
  Wallet,
  Landmark,
  ShoppingCart,
  ArrowUpCircle,
  ArrowDownCircle,
  FileSpreadsheet,
  GitMerge,
  Receipt,
  BarChart3,
  Settings,
  ChevronLeft
} from "lucide-react";
import Link from "next/link";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { SidebarItem } from "./SidebarItem";
import { SidebarSection } from "./SidebarSection";
import { CompanySelector } from "./CompanySelector";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        sidebarCollapsed ? "w-14" : "w-60"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-4 border-b border-sidebar-border">
        <Link href="/inicio" className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            M
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold leading-tight">Money Mind</p>
              <p className="text-[11px] text-sidebar-foreground/60 leading-tight">BPO Financeiro</p>
            </div>
          )}
        </Link>
      </div>

      <div className="p-2 border-b border-sidebar-border">
        <CompanySelector collapsed={sidebarCollapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        <SidebarSection label="Principal" collapsed={sidebarCollapsed}>
          <SidebarItem href="/inicio" icon={LayoutDashboard} label="Início" collapsed={sidebarCollapsed} />
        </SidebarSection>

        <SidebarSection label="Cadastros" collapsed={sidebarCollapsed}>
          <SidebarItem
            href="/cadastros/clientes-fornecedores"
            icon={Users}
            label="Clientes / Fornecedores"
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            href="/cadastros/categorias"
            icon={Tag}
            label="Categorias"
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            href="/cadastros/formas-pagamento"
            icon={CreditCard}
            label="Formas de pagamento"
            collapsed={sidebarCollapsed}
          />
        </SidebarSection>

        <SidebarSection label="Finanças" collapsed={sidebarCollapsed}>
          <SidebarItem href="/financas/caixa" icon={Wallet} label="Caixa" collapsed={sidebarCollapsed} />
          <SidebarItem
            href="/financas/conta-digital"
            icon={Landmark}
            label="Conta digital"
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            href="/financas/transacoes-vendas"
            icon={ShoppingCart}
            label="Transações de vendas"
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            href="/financas/contas-a-pagar"
            icon={ArrowUpCircle}
            label="Contas a pagar"
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            href="/financas/contas-a-receber"
            icon={ArrowDownCircle}
            label="Contas a receber"
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            href="/financas/extratos-bancarios"
            icon={FileSpreadsheet}
            label="Extratos bancários"
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            href="/financas/conciliacao"
            icon={GitMerge}
            label="Conciliação"
            badge="IA"
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            href="/financas/cobrancas-bancarias"
            icon={Receipt}
            label="Cobranças bancárias"
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            href="/financas/cobranca-regua"
            icon={Receipt}
            label="Régua de cobrança"
            collapsed={sidebarCollapsed}
          />
          <SidebarItem
            href="/financas/relatorios"
            icon={BarChart3}
            label="Relatórios"
            collapsed={sidebarCollapsed}
          />
        </SidebarSection>

        <SidebarSection label="Sistema" collapsed={sidebarCollapsed}>
          <SidebarItem
            href="/configuracoes"
            icon={Settings}
            label="Configurações"
            collapsed={sidebarCollapsed}
          />
        </SidebarSection>
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")}
          />
        </Button>
      </div>
    </aside>
  );
}
