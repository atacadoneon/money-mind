"use client";

import * as React from "react";
import { Plus, Search, CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ContasReceberTable } from "@/components/tables/ContasReceberTable";
import { Pagination } from "@/components/tables/Pagination";
import { NovaContaReceberModal } from "@/components/modals/NovaContaReceberModal";
import { BaixarRecebimentoModal } from "@/components/modals/BaixarRecebimentoModal";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { AdvancedFilters, type AdvancedFilterValues, DEFAULT_FILTERS } from "@/components/filters/AdvancedFilters";
import { useContasReceber, useDeleteContaReceber } from "@/hooks/use-contas-receber";
import { useFiltersStore } from "@/store/filters";
import { formatCurrency } from "@/lib/format";
import type { ContaReceber, SituacaoCR } from "@/types";
import { format } from "date-fns";

const STATUS_TABS: { value: SituacaoCR | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "aberto", label: "Em aberto" },
  { value: "parcial", label: "Parciais" },
  { value: "recebido", label: "Recebidas" },
  { value: "atrasado", label: "Atrasadas" },
  { value: "cancelado", label: "Canceladas" }
];

const CR_SITUACOES = [
  { value: "aberto", label: "Em aberto" },
  { value: "recebido", label: "Recebido" },
  { value: "parcial", label: "Parcial" },
  { value: "atrasado", label: "Atrasado" },
  { value: "cancelado", label: "Cancelado" }
];

export default function ContasReceberPage() {
  const { contasReceber: filters, setContasReceber, getDateRange, setDateRange } = useFiltersStore();
  const storedRange = getDateRange("cr");
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

  const q = useContasReceber(effectiveFilters);
  const del = useDeleteContaReceber();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [novoOpen, setNovoOpen] = React.useState(false);
  const [baixarOpen, setBaixarOpen] = React.useState(false);
  const [conta, setConta] = React.useState<ContaReceber | null>(null);
  const [search, setSearch] = React.useState(filters.search ?? "");

  React.useEffect(() => {
    const t = setTimeout(() => setContasReceber({ search, page: 1 }), 400);
    return () => clearTimeout(t);
  }, [search, setContasReceber]);

  const handleDateRangeChange = (r: { from: Date | null; to: Date | null }) => {
    setDateRangeLocal(r);
    setDateRange("cr", {
      from: r.from ? r.from.toISOString() : null,
      to: r.to ? r.to.toISOString() : null
    });
    setContasReceber({
      vencimentoFrom: r.from ? format(r.from, "yyyy-MM-dd") : undefined,
      vencimentoTo: r.to ? format(r.to, "yyyy-MM-dd") : undefined,
      page: 1
    });
  };

  const data = q.data?.data ?? [];
  const total = q.data?.total ?? 0;
  const totalValor = data.reduce((s, c) => s + Number(c.valor), 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((prev) => (prev.size === data.length ? new Set() : new Set(data.map((d) => d.id))));

  return (
    <>
      <PageHeader
        title="Contas a receber"
        description="Gerencie títulos a receber, clientes e recebimentos"
        actions={
          <>
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="h-4 w-4" /> Exportar XLSX
            </Button>
            <Button variant="outline" size="sm">
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
          onValueChange={(v) =>
            setContasReceber({ situacao: v as SituacaoCR | "todas", page: 1 })
          }
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
              placeholder="Buscar cliente, histórico, documento..."
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
            situacaoOptions={CR_SITUACOES}
            contatoLabel="Cliente"
          />
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
            <span className="text-sm font-medium px-2">{selected.size} selecionadas</span>
            <Button size="sm" variant="success">
              <CheckCircle2 className="h-4 w-4" /> Baixar em lote
            </Button>
          </div>
        )}

        {q.isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : q.isError ? (
          <EmptyState
            title="Erro ao carregar"
            description="Não foi possível buscar contas. Tente novamente."
            action={<Button onClick={() => q.refetch()}>Tentar de novo</Button>}
          />
        ) : data.length === 0 ? (
          <EmptyState title="Nenhuma conta encontrada" description="Ajuste os filtros ou cadastre uma nova conta a receber." />
        ) : (
          <>
            <ContasReceberTable
              data={data}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onBaixar={(c) => {
                setConta(c);
                setBaixarOpen(true);
              }}
              onDelete={(c) => {
                if (confirm("Excluir?")) del.mutate(c.id);
              }}
            />
            <div className="text-sm text-muted-foreground">
              Total: <span className="font-medium text-foreground">{formatCurrency(totalValor)}</span>
            </div>
            <Pagination
              page={filters.page ?? 1}
              pageSize={filters.pageSize ?? 25}
              total={total}
              onPageChange={(p) => setContasReceber({ page: p })}
              onPageSizeChange={(s) => setContasReceber({ pageSize: s, page: 1 })}
            />
          </>
        )}
      </div>

      <NovaContaReceberModal open={novoOpen} onOpenChange={setNovoOpen} />
      <BaixarRecebimentoModal open={baixarOpen} onOpenChange={setBaixarOpen} conta={conta} />
    </>
  );
}
