"use client";

import * as React from "react";
import { Upload, FileSpreadsheet, ChevronDown, ChevronRight } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useExtratos, useUploadExtratoOfx, useExtratoLinhas } from "@/hooks/use-extratos";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import type { ExtratoBancario } from "@/types";

const STATUS_VARIANT: Record<
  ExtratoBancario["status"],
  "default" | "secondary" | "success"
> = {
  importado: "secondary",
  em_conciliacao: "default",
  conciliado: "success"
};

const STATUS_LABEL: Record<ExtratoBancario["status"], string> = {
  importado: "Importado",
  em_conciliacao: "Em conciliação",
  conciliado: "Conciliado"
};

function DropzoneUpload({ onUpload }: { onUpload: (file: File) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/x-ofx": [".ofx"] },
    multiple: false,
    onDrop: (files) => {
      if (files[0]) onUpload(files[0]);
    }
  });

  return (
    <div
      {...getRootProps()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary hover:bg-muted/30"
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="font-medium">Arraste o arquivo OFX aqui</p>
      <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
      <p className="text-xs text-muted-foreground mt-3">Suporte: .ofx (extratos bancários)</p>
    </div>
  );
}

function ExtratoLinhas({ extratoId }: { extratoId: string }) {
  const q = useExtratoLinhas(extratoId);
  const linhas = q.data ?? [];

  if (q.isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    );
  }

  if (linhas.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma linha encontrada</p>
    );
  }

  return (
    <div className="border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l) => (
            <TableRow key={l.id} className="text-sm">
              <TableCell>{formatDate(l.data)}</TableCell>
              <TableCell className="max-w-xs truncate">{l.descricao}</TableCell>
              <TableCell>
                <Badge variant={l.tipo === "credito" ? "success" : "destructive"}>
                  {l.tipo === "credito" ? "Crédito" : "Débito"}
                </Badge>
              </TableCell>
              <TableCell
                className={`text-right font-medium ${
                  l.tipo === "credito" ? "text-success" : "text-destructive"
                }`}
              >
                {l.tipo === "credito" ? "+" : "-"}
                {formatCurrency(l.valor)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    l.status === "conciliado"
                      ? "success"
                      : l.status === "ignorado"
                      ? "outline"
                      : "secondary"
                  }
                >
                  {l.status === "conciliado"
                    ? "Conciliada"
                    : l.status === "ignorado"
                    ? "Ignorada"
                    : "Pendente"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ExtratoRow({ extrato }: { extrato: ExtratoBancario }) {
  const [expanded, setExpanded] = React.useState(false);
  const pct =
    extrato.linhasTotal > 0
      ? (extrato.linhasConciliadas / extrato.linhasTotal) * 100
      : 0;

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded((e) => !e)}
      >
        <TableCell className="w-6">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </TableCell>
        <TableCell className="font-medium">{extrato.bancoNome}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{extrato.contaNumero ?? extrato.conta}</TableCell>
        <TableCell className="text-sm">
          {formatDate(extrato.dataInicio)} — {formatDate(extrato.dataFim)}
        </TableCell>
        <TableCell className="text-right">{formatCurrency(extrato.saldoInicial)}</TableCell>
        <TableCell className="text-right">{formatCurrency(extrato.saldoFinal)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-12 text-right">
              {formatPercent(pct, 0)}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={STATUS_VARIANT[extrato.status]}>{STATUS_LABEL[extrato.status]}</Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDate(extrato.criadoEm)}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={9} className="p-0">
            <ExtratoLinhas extratoId={extrato.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function ExtratosBancariosPage() {
  const q = useExtratos({});
  const upload = useUploadExtratoOfx();

  const extratos = q.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Extratos bancários"
        description="Importe arquivos OFX para conciliação"
      />

      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <DropzoneUpload
              onUpload={(file) => upload.mutate(file)}
            />
            {upload.isPending && (
              <p className="text-sm text-center text-muted-foreground mt-3 animate-pulse">
                Importando extrato...
              </p>
            )}
          </CardContent>
        </Card>

        {q.isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : extratos.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Nenhum extrato importado"
            description="Arraste um arquivo OFX acima para importar o extrato do seu banco."
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6" />
                  <TableHead>Banco</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Saldo inicial</TableHead>
                  <TableHead className="text-right">Saldo final</TableHead>
                  <TableHead>Conciliação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Importado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extratos.map((e) => (
                  <ExtratoRow key={e.id} extrato={e} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
