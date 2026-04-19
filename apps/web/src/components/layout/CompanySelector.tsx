"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function CompanySelector({ collapsed }: { collapsed?: boolean }) {
  const { companies, selectedCompany, setSelectedCompany } = useAuthStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-2 text-left transition-colors hover:bg-sidebar-accent",
          collapsed && "justify-center"
        )}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
          style={{ backgroundColor: selectedCompany?.avatarColor ?? "#3b82f6" }}
        >
          {selectedCompany?.nome.slice(0, 2).toUpperCase() ?? "GL"}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs text-sidebar-foreground/60">Empresa</p>
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {selectedCompany?.nome ?? "Selecionar"}
              </p>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-sidebar-foreground/50" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Grupo Lauxen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => setSelectedCompany(c)}>
            <div
              className="h-5 w-5 rounded text-[10px] font-bold text-white flex items-center justify-center"
              style={{ backgroundColor: c.avatarColor }}
            >
              {c.nome.slice(0, 1)}
            </div>
            <span className="flex-1">{c.nome}</span>
            {selectedCompany?.id === c.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
