"use client";

import * as React from "react";
import { Receipt, RefreshCw, Copy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";

interface CobrancaBancaria {
  id: string;
  nossoNumero: string;
  pagadorNome: string;
  pagadorDocumento?: string;
  valor: number;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento?: string;
  status: "aguardando" | "pago" | "vencido" | "cancelado";
  banco: string;
  linhaDigitavel?: string;
}

interface CobrancasResponse {
  data: CobrancaBancaria[];
  total: number;
}

const STATUS_VARIANT: Record<
  CobrancaBancaria["status"],
  "secondary" | "success" | "destructive" | "outline"
> = {
  aguardando: "secondary",
  pago: "success",
  vencido: "destructive",
  cancelado: "outline"
};

const STATUS_LABEL: Record<CobrancaBancaria["status"], string> = {
  aguardando: "Aguardando",
  pago: "Pago",
  vencido: "Vencido",
  cancelado: "Cancelado"
};

export default function CobrancasBancariasPage() {
  const [search, setSearch] = React.useState("");

  const q = useQuery<CobrancasResponse>({
    queryKey: ["cobrancas-bancarias"],
    queryFn: async () => {
      const { data } = await api.get<CobrancasResponse>("/cobrancas-bancarias");
      return data;
    }
  });

  const cobrancas = (q.data?.data ?? []).filter(
    (c) =>
      !search ||
      c.pagadorNome.toLowerCase().includes(search.toLowerCase()) ||
      c.nossoNumero.includes(search)
  );

  const copyLinhaDigitavel = (linha: string) => {
    navigator.clipboard.writeText(linha);
    toast.success("Linha digitável copiada");
  };

  return (
    <>
      <PageHeader
        title="Cobranças bancárias"
        description="Boletos gerados e status de pagamento"
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

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Input
              placeholder="Buscar por pagador ou nosso número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-3"
            />
          </div>
        </div>

        {q.isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : q.isError ? (
          <EmptyState
            icon={Receipt}
            title="Integração bancária não configurada"
            description="Configure a integração bancária (Sicoob, Bradesco) em Configurações > Integrações para visualizar cobranças."
          />
        ) : cobrancas.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhuma cobrança encontrada"
            description="Os boletos gerados e cobranças bancárias aparecerão aqui."
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nosso número</TableHead>
                  <TableHead>Pagador</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.nossoNumero}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{c.pagadorNome}</p>
                      {c.pagadorDocumento && (
                        <p className="text-xs text-muted-foreground">{c.pagadorDocumento}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.banco}</TableCell>
                    <TableCell className="text-sm">{formatDate(c.dataEmissao)}</TableCell>
                    <TableCell
                      className={`text-sm ${
                        c.status === "vencido" ? "text-destructive font-medium" : ""
                      }`}
                    >
                      {formatDate(c.dataVencimento)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.dataPagamento ? formatDate(c.dataPagamento) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(c.valor)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      {c.linhaDigitavel && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Copiar linha digitável"
                          onClick={() => copyLinhaDigitavel(c.linhaDigitavel!)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
