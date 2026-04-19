"use client";

import * as React from "react";
import { Landmark, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useContasBancarias, useTransacoesContaDigital } from "@/hooks/use-conta-digital";
import { formatCurrency, formatDate } from "@/lib/format";

function ContaCard({
  id,
  nome,
  banco,
  saldo,
  selected,
  onSelect
}: {
  id: string;
  nome: string;
  banco: string;
  saldo: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 w-full ${
        selected ? "border-primary bg-primary/5" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium">{nome}</p>
          <p className="text-xs text-muted-foreground">{banco}</p>
        </div>
        <Landmark className="h-4 w-4 text-muted-foreground" />
      </div>
      <p
        className={`mt-3 text-lg font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}
      >
        {formatCurrency(saldo)}
      </p>
    </button>
  );
}

export default function ContaDigitalPage() {
  const contasQ = useContasBancarias();
  const contas = contasQ.data ?? [];
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (contas.length > 0 && !selectedId && contas[0]) {
      setSelectedId(contas[0].id);
    }
  }, [contas, selectedId]);

  const transacoesQ = useTransacoesContaDigital(selectedId, 30);
  const transacoes = transacoesQ.data ?? [];
  const saldoTotal = contas.reduce((s, c) => s + c.saldo, 0);

  return (
    <>
      <PageHeader
        title="Conta digital"
        description="Saldos e transações das contas bancárias"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => contasQ.refetch()}
            disabled={contasQ.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${contasQ.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {contasQ.isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : contas.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Nenhuma conta configurada"
            description="Configure as contas bancárias em Configurações > Integrações."
          />
        ) : (
          <>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Saldo consolidado</p>
              <p
                className={`text-3xl font-bold ${saldoTotal >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatCurrency(saldoTotal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {contas.length} conta{contas.length > 1 ? "s" : ""} conectada{contas.length > 1 ? "s" : ""}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {contas.map((c) => (
                <ContaCard
                  key={c.id}
                  id={c.id}
                  nome={c.nome}
                  banco={c.banco}
                  saldo={c.saldo}
                  selected={selectedId === c.id}
                  onSelect={() => setSelectedId(c.id)}
                />
              ))}
            </div>

            {selectedId && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>
                    Últimas transações —{" "}
                    {contas.find((c) => c.id === selectedId)?.nome ?? ""}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {transacoesQ.isLoading ? (
                    <div className="space-y-2">
                      {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-10" />
                      ))}
                    </div>
                  ) : transacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma transação recente
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Saldo após</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transacoes.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">{formatDate(t.data)}</TableCell>
                            <TableCell className="font-medium text-sm">{t.descricao}</TableCell>
                            <TableCell>
                              {t.tipo === "credito" ? (
                                <Badge variant="success">
                                  <TrendingDown className="h-3 w-3 mr-1" /> Crédito
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <TrendingUp className="h-3 w-3 mr-1" /> Débito
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell
                              className={`text-right font-semibold ${
                                t.tipo === "credito" ? "text-success" : "text-destructive"
                              }`}
                            >
                              {t.tipo === "credito" ? "+" : "-"}
                              {formatCurrency(t.valor)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {formatCurrency(t.saldoApos)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
