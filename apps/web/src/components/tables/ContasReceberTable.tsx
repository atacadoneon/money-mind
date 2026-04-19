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
import { MoreHorizontal, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency, formatDate, truncate } from "@/lib/format";
import type { ContaReceber } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  data: ContaReceber[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onBaixar: (c: ContaReceber) => void;
  onDelete?: (c: ContaReceber) => void;
}

export function ContasReceberTable({ data, selected, onToggle, onToggleAll, onBaixar, onDelete }: Props) {
  const allChecked = data.length > 0 && data.every((d) => selected.has(d.id));

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={allChecked} onCheckedChange={onToggleAll} />
            </TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Histórico</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Forma</TableHead>
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
                  {truncate(c.historico, 40)}
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
                      {c.situacao !== "recebido" && (
                        <DropdownMenuItem onSelect={() => onBaixar(c)}>
                          <CheckCircle2 className="h-4 w-4" /> Baixar recebimento
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem>
                        <Pencil className="h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onDelete?.(c)} className="text-destructive">
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
