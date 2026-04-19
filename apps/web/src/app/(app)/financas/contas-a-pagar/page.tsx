"use client";

import * as React from "react";
import { Plus, Search, Download, CheckCircle2, Tag, Trash2, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ContasPagarTable } from "@/components/tables/ContasPagarTable";
import { Pagination } from "@/components/tables/Pagination";
import { NovaContaPagarModal } from "@/components/modals/NovaContaPagarModal";
import { BaixarPagamentoModal } from "@/components/modals/BaixarPagamentoModal";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { AdvancedFilters, type AdvancedFilterValues, DEFAULT_FILTERS } from "@/components/filters/AdvancedFilters";
import { useContasPagar, useBulkBaixarContasPagar, useDeleteContaPagar } from "@/hooks/use-contas-pagar";
import { useFiltersStore } from "@/store/filters";
import { formatCurrency } from "@/lib/format";
import type { ContaPagar, SituacaoCP } from "@/types";
import { exportContasPagar } from "@/lib/api/contas-pagar.api";
import { toast } from "sonner";
import { format } from "date-fns";
import { ImportWizard } from "@/components/import/ImportWizard";

const STATUS_TABS: { value: SituacaoCP | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "aberto", label: "Em aberto" },
  { value: "parcial", label: "Parciais" },
  { value: "pago", label: "Pagas" },
  { value: "atrasado", label: "Atrasadas" },
  { value: "cancelado", label: "Canceladas" }
];

const CP_SITUACOES = [
  { value: "aberto", label: "Em aberto" },
  { value: "pago", label: "Pago" },
  { value: "parcial", label: "Parcial" },
  { value: "atrasado", label: "Atrasado" },
  { value: "cancelado", label: "Cancelado" }
];

export default function ContasPagarPage() {
  const { contasPagar: filters, setContasPagar, getDateRange, setDateRange } = useFiltersStore();
  const storedRange = getDateRange("cp");
  const [dateRange, setDateRangeLocal] = React.useState({
    from: storedRange.from ? new Date(storedRange.from) : null,
    to: storedRange.to ? new Date(storedRange.to) : null
  });
  const [advFilters, setAdvFilters] = React.useState<AdvancedFilterValues>(DEFAULT_FILTERS);

  const effectiveFilters = React.useMemo(() => ({
    ...filters,
    vencimentoFrom: dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : filters.vencimentoFrom,
    vencimentoTo: dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : filters.vencimentoTo,
    ...(advFilters.categoriaIds.length ? { categoriaId: advFilters.categoriaIds[0] } : {}),
    ...(advFilters.contatoId ? { contatoId: advFilters.contatoId } : {}),
    ...(advFilters.formaPagamentoIds.length ? { formaPagamentoId: advFilters.formaPagamentoIds[0] } : {}),
    ...(advFilters.valorMin != null ? { valorMin: advFilters.valorMin } : {}),
    ...(advFilters.valorMax != null ? { valorMax: advFilters.valorMax } : {}),
    ...(advFilters.marcador ? { marcador: advFilters.marcador } : {})
  }), [filters, dateRange, advFilters]);

  const q = useContasPagar(effectiveFilters);
  const bulkBaixar = useBulkBaixarContasPagar();
  const del = useDeleteContaPagar();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [novoOpen, setNovoOpen] = React.useState(false);
  const [baixarOpen, setBaixarOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [contaBaixar, setContaBaixar] = React.useState<ContaPagar | null>(null);
  const [search, setSearch] = React.useState(filters.search ?? "");

  React.useEffect(() => {
    const t = setTimeout(() => setContasPagar({ search, page: 1 }), 400);
    return () => clearTimeout(t);
  }, [search, setContasPagar]);

  const handleDateRangeChange = (r: { from: Date | null; to: Date | null }) => {
    setDateRangeLocal(r);
    setDateRange("cp", {
      from: r.from ? r.from.toISOString() : null,
      to: r.to ? r.to.toISOString() : null
    });
    setContasPagar({ page: 1 });
  };

  const data = q.data?.data ?? [];
  const total = q.data?.total ?? 0;
  const totalValor = data.reduce((sum, c) => sum + Number(c.valor), 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const toggleAll = () =>
    setSelected((prev) => (prev.size === data.length ? new Set() : new Set(data.map((d) => d.id))));

  const onBaixar = (c: ContaPagar) => {
    setContaBaixar(c);
    setBaixarOpen(true);
  };

  const onBulkBaixar = async () => {
    if (selected.size === 0) return;
    await bulkBaixar.mutateAsync({
      ids: Array.from(selected),
      dataPagamento: new Date().toISOString().slice(0, 10)
    });
    setSelected(new Set());
  };

  const onExport = async (formato: "xlsx" | "csv") => {
    try {
      const blob = await exportContasPagar(effectiveFilters, formato);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contas-pagar.${formato}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Falha ao exportar");
    }
  };

  return (
    <>
      <PageHeader
        title="Contas a pagar"
        description="Gerencie títulos a pagar, vencimentos e pagamentos"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" /> Importar
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExport("xlsx")}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar XLSX
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExport("csv")}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button size="sm" onClick={() => setNovoOpen(true)}>
              <Plus className="h-4 w-4" /> Nova conta
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <Tabs
          value={filters.situacao ?? "todas"}
          onValueChange={(v) => setContasPagar({ situacao: v as SituacaoCP | "todas", page: 1 })}
        >
          <TabsList>
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-start gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar fornecedor, histórico, documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            placeholder="Período de vencimento"
          />
          <AdvancedFilters
            values={advFilters}
            onChange={setAdvFilters}
            situacaoOptions={CP_SITUACOES}
            contatoLabel="Fornecedor"
          />
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
            <span className="text-sm font-medium px-2">
              {selected.size} {selected.size === 1 ? "conta selecionada" : "contas selecionadas"}
            </span>
            <Button size="sm" variant="success" onClick={onBulkBaixar} disabled={bulkBaixar.isPending}>
              <CheckCircle2 className="h-4 w-4" /> Baixar em lote
            </Button>
            <Button size="sm" variant="outline">
              <Tag className="h-4 w-4" /> Alterar categoria
            </Button>
            <Button size="sm" variant="outline">
              <Tag className="h-4 w-4" /> Alterar marcadores
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                if (!confirm(`Excluir ${selected.size} contas?`)) return;
                for (const id of Array.from(selected)) await del.mutateAsync(id);
                setSelected(new Set());
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </div>
        )}

        {q.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : q.isError ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Erro ao carregar"
            description="Não foi possível buscar contas. Tente novamente."
            action={<Button onClick={() => q.refetch()}>Tentar de novo</Button>}
          />
        ) : data.length === 0 ? (
          <EmptyState
            title="Nenhuma conta encontrada"
            description="Ajuste os filtros ou cadastre uma nova conta a pagar."
            action={
              <Button onClick={() => setNovoOpen(true)}>
                <Plus className="h-4 w-4" /> Nova conta
              </Button>
            }
          />
        ) : (
          <>
            <ContasPagarTable
              data={data}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onBaixar={onBaixar}
              sortBy={filters.sortBy}
              sortDir={filters.sortDir}
              onSort={(field) =>
                setContasPagar({
                  sortBy: field,
                  sortDir: filters.sortBy === field && filters.sortDir === "asc" ? "desc" : "asc"
                })
              }
              onDelete={(c) => {
                if (confirm("Excluir esta conta?")) del.mutate(c.id);
              }}
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Total exibido: <span className="font-medium text-foreground">{formatCurrency(totalValor)}</span>
              </span>
            </div>
            <Pagination
              page={filters.page ?? 1}
              pageSize={filters.pageSize ?? 25}
              total={total}
              onPageChange={(p) => setContasPagar({ page: p })}
              onPageSizeChange={(s) => setContasPagar({ pageSize: s, page: 1 })}
            />
          </>
        )}
      </div>

      <NovaContaPagarModal open={novoOpen} onOpenChange={setNovoOpen} />
      <BaixarPagamentoModal open={baixarOpen} onOpenChange={setBaixarOpen} conta={contaBaixar} />
      <ImportWizard open={importOpen} onOpenChange={setImportOpen} type="contas-pagar" />
    </>
  );
}
