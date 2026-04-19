"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, CheckCircle2, Eye, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency, formatDate, truncate } from "@/lib/format";
import type { ContaPagar } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  data: ContaPagar[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onBaixar: (c: ContaPagar) => void;
  onEdit?: (c: ContaPagar) => void;
  onDelete?: (c: ContaPagar) => void;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSort?: (field: string) => void;
}

const columns: { key: string; label: string; sortable?: boolean; className?: string }[] = [
  { key: "contatoNome", label: "Fornecedor", sortable: true },
  { key: "historico", label: "Histórico" },
  { key: "categoriaNome", label: "Categoria", sortable: true },
  { key: "dataVencimento", label: "Vencimento", sortable: true },
  { key: "valor", label: "Valor", sortable: true, className: "text-right" },
  { key: "saldo", label: "Saldo", className: "text-right" },
  { key: "situacao", label: "Situação" },
  { key: "formaPagamentoNome", label: "Forma pgto" }
];

export function ContasPagarTable({
  data,
  selected,
  onToggle,
  onToggleAll,
  onBaixar,
  onEdit,
  onDelete,
  sortBy,
  sortDir,
  onSort
}: Props) {
  const allChecked = data.length > 0 && data.every((d) => selected.has(d.id));

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allChecked}
                onCheckedChange={onToggleAll}
                aria-label="Selecionar todos"
              />
            </TableHead>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.sortable && onSort ? (
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => onSort(col.key)}
                  >
                    {col.label}
                    {sortBy === col.key ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                ) : (
                  col.label
                )}
              </TableHead>
            ))}
            <TableHead className="w-10 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((c) => {
            const isChecked = selected.has(c.id);
            const atrasada = c.situacao === "atrasado";
            return (
              <TableRow
                key={c.id}
                data-state={isChecked ? "selected" : undefined}
                className={cn(atrasada && "bg-destructive/5")}
              >
                <TableCell>
                  <Checkbox checked={isChecked} onCheckedChange={() => onToggle(c.id)} />
                </TableCell>
                <TableCell className="font-medium">{c.contatoNome ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground">
                  <span title={c.historico}>{truncate(c.historico, 40)}</span>
                  {c.marcadores?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.marcadores.map((m) => (
                        <Badge key={m} variant="outline" className="text-[10px]">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>{c.categoriaNome}</TableCell>
                <TableCell className={cn(atrasada && "text-destructive font-medium")}>
                  {formatDate(c.dataVencimento)}
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(c.valor)}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(c.saldo)}</TableCell>
                <TableCell>
                  <StatusBadge status={c.situacao} />
                </TableCell>
                <TableCell className="text-muted-foreground">{c.formaPagamentoNome ?? "-"}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Ações">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {c.situacao !== "pago" && (
                        <DropdownMenuItem onSelect={() => onBaixar(c)}>
                          <CheckCircle2 className="h-4 w-4" /> Baixar pagamento
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => onEdit?.(c)}>
                        <Pencil className="h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onEdit?.(c)}>
                        <Eye className="h-4 w-4" /> Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => onDelete?.(c)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
