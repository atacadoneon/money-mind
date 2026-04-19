"use client";

import * as React from "react";
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  useSaldoCaixa,
  useLancamentosCaixa,
  useCreateLancamentoCaixa,
  useDeleteLancamentoCaixa
} from "@/hooks/use-caixa";
import { useCategorias } from "@/hooks/use-categorias";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatCurrency, formatDate, parseCurrencyInput } from "@/lib/format";
import type { LancamentoCaixa } from "@/lib/api/caixa.api";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format } from "date-fns";

const schema = z.object({
  descricao: z.string().min(2, "Descrição obrigatória"),
  tipo: z.enum(["entrada", "saida"]),
  valor: z.string().min(1, "Valor obrigatório"),
  data: z.string().min(1, "Data obrigatória"),
  categoriaId: z.string().optional(),
  observacoes: z.string().optional()
});

type FormData = z.infer<typeof schema>;

function LancamentoModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const create = useCreateLancamentoCaixa();
  const categorias = useCategorias();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: "saida",
      data: new Date().toISOString().slice(0, 10)
    }
  });

  React.useEffect(() => {
    if (open) {
      reset({ tipo: "saida", data: new Date().toISOString().slice(0, 10), descricao: "", valor: "" });
    }
  }, [open, reset]);

  const tipoWatch = watch("tipo");

  const onSubmit = async (values: FormData) => {
    await create.mutateAsync({
      descricao: values.descricao,
      tipo: values.tipo,
      valor: parseCurrencyInput(values.valor),
      data: values.data,
      categoriaId: values.categoriaId || undefined,
      observacoes: values.observacoes || undefined
    } as Partial<LancamentoCaixa>);
    onOpenChange(false);
  };

  const catsFiltradas = (categorias.data ?? []).filter(
    (c) => c.tipo === (tipoWatch === "entrada" ? "receita" : "despesa")
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lançamento de caixa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select
                value={watch("tipo")}
                onValueChange={(v) => setValue("tipo", v as "entrada" | "saida")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" {...register("data")} />
              {errors.data && <p className="text-xs text-destructive">{errors.data.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Descrição *</Label>
            <Input {...register("descricao")} placeholder="Descrição do lançamento" />
            {errors.descricao && (
              <p className="text-xs text-destructive">{errors.descricao.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Valor *</Label>
            <Input {...register("valor")} placeholder="0,00" />
            {errors.valor && <p className="text-xs text-destructive">{errors.valor.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select
              value={watch("categoriaId") ?? ""}
              onValueChange={(v) => setValue("categoriaId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sem categoria</SelectItem>
                {catsFiltradas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CaixaPage() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null
  });

  const saldoQ = useSaldoCaixa();
  const lancamentosQ = useLancamentosCaixa({
    dataFrom: dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    dataTo: dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : undefined
  });
  const del = useDeleteLancamentoCaixa();

  const lancamentos = lancamentosQ.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Caixa"
        description="Movimentações manuais de caixa"
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Novo lançamento
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {saldoQ.isLoading ? (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          ) : (
            <>
              <Card>
                <CardContent className="flex items-center gap-3 p-5">
                  <Wallet className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo atual</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(saldoQ.data?.saldoAtual ?? 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-5">
                  <TrendingDown className="h-8 w-8 text-success" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total entradas</p>
                    <p className="text-xl font-bold text-success">
                      {formatCurrency(saldoQ.data?.totalEntradas ?? 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-5">
                  <TrendingUp className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total saídas</p>
                    <p className="text-xl font-bold text-destructive">
                      {formatCurrency(saldoQ.data?.totalSaidas ?? 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Filtrar por período"
          />
        </div>

        {lancamentosQ.isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : lancamentos.length === 0 ? (
          <EmptyState
            title="Nenhum lançamento"
            description="Registre entradas e saídas de caixa manualmente."
            action={
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" /> Novo lançamento
              </Button>
            }
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo após</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancamentos.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{formatDate(l.data)}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{l.descricao}</p>
                      {l.categoriaNome && (
                        <p className="text-xs text-muted-foreground">{l.categoriaNome}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.tipo === "entrada" ? "success" : "destructive"}>
                        {l.tipo === "entrada" ? "Entrada" : "Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        l.tipo === "entrada" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {l.tipo === "entrada" ? "+" : "-"}
                      {formatCurrency(l.valor)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatCurrency(l.saldoApos)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Excluir este lançamento?")) del.mutate(l.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <LancamentoModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
