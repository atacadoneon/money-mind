"use client";

import * as React from "react";
import { ShoppingCart, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/format";

interface TransacaoVenda {
  id: string;
  gateway: string;
  status: string;
  valor: number;
  taxa: number;
  valorLiquido: number;
  pagadorNome?: string;
  pagadorDocumento?: string;
  criadoEm: string;
  liquidadoEm?: string;
}

interface TransacoesResponse {
  data: TransacaoVenda[];
  total: number;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "destructive" | "outline"> = {
  paid: "success",
  authorized: "success",
  processing: "default",
  waiting_payment: "secondary",
  refused: "destructive",
  refunded: "outline",
  chargedback: "destructive"
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Pago",
  authorized: "Autorizado",
  processing: "Processando",
  waiting_payment: "Aguardando",
  refused: "Recusado",
  refunded: "Estornado",
  chargedback: "Chargeback"
};

export default function TransacoesVendasPage() {
  const q = useQuery<TransacoesResponse>({
    queryKey: ["transacoes-vendas"],
    queryFn: async () => {
      const { data } = await api.get<TransacoesResponse>("/transacoes-vendas");
      return data;
    }
  });

  const transacoes = q.data?.data ?? [];
  const total = q.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Transações de vendas"
        description={`${total} transações via gateways de pagamento`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      <div className="p-6">
        {q.isLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : q.isError ? (
          <EmptyState
            icon={ShoppingCart}
            title="Integração não configurada"
            description="Configure os gateways de pagamento (Pagar.me, AppMax) em Configurações > Integrações para sincronizar transações."
            action={
              <Button variant="outline" onClick={() => q.refetch()}>
                Tentar novamente
              </Button>
            }
          />
        ) : transacoes.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhuma transação encontrada"
            description="As transações de venda sincronizadas dos gateways aparecerão aqui."
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Pagador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor bruto</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Valor líquido</TableHead>
                  <TableHead>Liquidação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transacoes.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{formatDate(t.criadoEm)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.gateway}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.pagadorNome ?? "-"}
                      {t.pagadorDocumento && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({t.pagadorDocumento})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[t.status] ?? "outline"}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(t.valor)}
                    </TableCell>
                    <TableCell className="text-right text-destructive text-sm">
                      -{formatCurrency(t.taxa)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      {formatCurrency(t.valorLiquido)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.liquidadoEm ? formatDate(t.liquidadoEm) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
