"use client";

import * as React from "react";
import { ExternalLink, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Invoice } from "@/lib/api/billing.api";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Pago", variant: "default" },
  open: { label: "Aberto", variant: "secondary" },
  draft: { label: "Rascunho", variant: "outline" },
  void: { label: "Cancelado", variant: "outline" },
  uncollectible: { label: "Inadimplente", variant: "destructive" },
};

interface InvoicesTableProps {
  invoices: Invoice[];
}

export function InvoicesTable({ invoices }: InvoicesTableProps) {
  if (invoices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma fatura encontrada.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const statusConfig = STATUS_LABELS[inv.status] ?? { label: inv.status, variant: "outline" as const };
            return (
              <TableRow key={inv.id}>
                <TableCell className="text-sm">
                  {inv.createdAt
                    ? format(new Date(inv.createdAt), "dd/MM/yyyy", { locale: ptBR })
                    : "—"}
                </TableCell>
                <TableCell className="font-medium">
                  R$ {Number(inv.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {inv.dueAt ? format(new Date(inv.dueAt), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {inv.hostedInvoiceUrl && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                        <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                    {inv.pdfUrl && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                        <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
