"use client";

import * as React from "react";
import { Filter, X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { useCategorias } from "@/hooks/use-categorias";
import { useContatos } from "@/hooks/use-contatos";
import { useFormasPagamento } from "@/hooks/use-formas-pagamento";
import { formatCurrency } from "@/lib/format";
import { format } from "date-fns";

export interface AdvancedFilterValues {
  categoriaIds: string[];
  contatoId?: string;
  formaPagamentoIds: string[];
  valorMin?: number;
  valorMax?: number;
  situacoes: string[];
  marcador?: string;
  vencimento: DateRange;
  emissao: DateRange;
}

const DEFAULT_FILTERS: AdvancedFilterValues = {
  categoriaIds: [],
  formaPagamentoIds: [],
  situacoes: [],
  vencimento: { from: null, to: null },
  emissao: { from: null, to: null }
};

function countActiveFilters(v: AdvancedFilterValues): number {
  let n = 0;
  if (v.categoriaIds.length) n++;
  if (v.contatoId) n++;
  if (v.formaPagamentoIds.length) n++;
  if (v.valorMin != null || v.valorMax != null) n++;
  if (v.situacoes.length) n++;
  if (v.marcador) n++;
  if (v.vencimento.from || v.vencimento.to) n++;
  if (v.emissao.from || v.emissao.to) n++;
  return n;
}

interface ActiveChip {
  label: string;
  onRemove: () => void;
}

function buildActiveChips(
  values: AdvancedFilterValues,
  onChange: (v: AdvancedFilterValues) => void,
  categorias: Array<{ id: string; nome: string }>,
  contatos: Array<{ id: string; nome: string }>,
  formas: Array<{ id: string; nome: string }>
): ActiveChip[] {
  const chips: ActiveChip[] = [];

  values.categoriaIds.forEach((id) => {
    const cat = categorias.find((c) => c.id === id);
    if (cat) {
      chips.push({
        label: `Categoria: ${cat.nome}`,
        onRemove: () =>
          onChange({ ...values, categoriaIds: values.categoriaIds.filter((x) => x !== id) })
      });
    }
  });

  if (values.contatoId) {
    const cnt = contatos.find((c) => c.id === values.contatoId);
    if (cnt) {
      chips.push({
        label: `Contato: ${cnt.nome}`,
        onRemove: () => onChange({ ...values, contatoId: undefined })
      });
    }
  }

  values.formaPagamentoIds.forEach((id) => {
    const fp = formas.find((f) => f.id === id);
    if (fp) {
      chips.push({
        label: `Pagamento: ${fp.nome}`,
        onRemove: () =>
          onChange({ ...values, formaPagamentoIds: values.formaPagamentoIds.filter((x) => x !== id) })
      });
    }
  });

  if (values.valorMin != null || values.valorMax != null) {
    const min = values.valorMin != null ? formatCurrency(values.valorMin) : "";
    const max = values.valorMax != null ? formatCurrency(values.valorMax) : "";
    chips.push({
      label: `Valor: ${min}${min && max ? " — " : ""}${max}`,
      onRemove: () => onChange({ ...values, valorMin: undefined, valorMax: undefined })
    });
  }

  if (values.marcador) {
    chips.push({
      label: `Marcador: ${values.marcador}`,
      onRemove: () => onChange({ ...values, marcador: undefined })
    });
  }

  if (values.vencimento.from || values.vencimento.to) {
    const f = values.vencimento.from ? format(values.vencimento.from, "dd/MM/yyyy") : "";
    const t = values.vencimento.to ? format(values.vencimento.to, "dd/MM/yyyy") : "";
    chips.push({
      label: `Venc: ${f}${f && t ? " — " : ""}${t}`,
      onRemove: () => onChange({ ...values, vencimento: { from: null, to: null } })
    });
  }

  if (values.emissao.from || values.emissao.to) {
    const f = values.emissao.from ? format(values.emissao.from, "dd/MM/yyyy") : "";
    const t = values.emissao.to ? format(values.emissao.to, "dd/MM/yyyy") : "";
    chips.push({
      label: `Emissão: ${f}${f && t ? " — " : ""}${t}`,
      onRemove: () => onChange({ ...values, emissao: { from: null, to: null } })
    });
  }

  values.situacoes.forEach((s) => {
    chips.push({
      label: `Situação: ${s}`,
      onRemove: () =>
        onChange({ ...values, situacoes: values.situacoes.filter((x) => x !== s) })
    });
  });

  return chips;
}

interface AdvancedFiltersProps {
  values: AdvancedFilterValues;
  onChange: (v: AdvancedFilterValues) => void;
  situacaoOptions: Array<{ value: string; label: string }>;
  contatoLabel?: string; // "Fornecedor" ou "Cliente"
}

export function AdvancedFilters({
  values,
  onChange,
  situacaoOptions,
  contatoLabel = "Contato"
}: AdvancedFiltersProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<AdvancedFilterValues>(values);
  const [contatoSearch, setContatoSearch] = React.useState("");

  const categoriasQ = useCategorias();
  const contatosQ = useContatos({ search: contatoSearch || undefined, pageSize: 20 });
  const formasQ = useFormasPagamento();

  const categorias = categoriasQ.data ?? [];
  const contatos = contatosQ.data?.data ?? [];
  const formas = formasQ.data ?? [];

  const activeCount = countActiveFilters(values);
  const chips = buildActiveChips(values, onChange, categorias, contatos, formas);

  React.useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  const toggleCategoria = (id: string) => {
    setDraft((d) => ({
      ...d,
      categoriaIds: d.categoriaIds.includes(id)
        ? d.categoriaIds.filter((x) => x !== id)
        : [...d.categoriaIds, id]
    }));
  };

  const toggleForma = (id: string) => {
    setDraft((d) => ({
      ...d,
      formaPagamentoIds: d.formaPagamentoIds.includes(id)
        ? d.formaPagamentoIds.filter((x) => x !== id)
        : [...d.formaPagamentoIds, id]
    }));
  };

  const toggleSituacao = (v: string) => {
    setDraft((d) => ({
      ...d,
      situacoes: d.situacoes.includes(v) ? d.situacoes.filter((x) => x !== v) : [...d.situacoes, v]
    }));
  };

  const applyFilters = () => {
    onChange(draft);
    setOpen(false);
  };

  const clearAll = () => {
    onChange(DEFAULT_FILTERS);
    setDraft(DEFAULT_FILTERS);
  };

  return (
    <div className="flex flex-col gap-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="relative"
            aria-label="Filtros avançados"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Mais filtros
            {activeCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1.5 -top-1.5 h-4 min-w-4 rounded-full px-1 text-[10px]"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros avançados
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6 pb-4">
            {/* Contato */}
            <div className="space-y-2">
              <Label>{contatoLabel}</Label>
              <Input
                placeholder={`Buscar ${contatoLabel.toLowerCase()}...`}
                value={contatoSearch}
                onChange={(e) => setContatoSearch(e.target.value)}
              />
              {contatos.length > 0 && (
                <Select
                  value={draft.contatoId ?? ""}
                  onValueChange={(v) => setDraft((d) => ({ ...d, contatoId: v || undefined }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Selecionar ${contatoLabel.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {contatos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Categorias */}
            <div className="space-y-2">
              <Label>Categorias</Label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded border p-2">
                {categorias.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`cat-${cat.id}`}
                      checked={draft.categoriaIds.includes(cat.id)}
                      onCheckedChange={() => toggleCategoria(cat.id)}
                    />
                    <label
                      htmlFor={`cat-${cat.id}`}
                      className="text-sm leading-tight cursor-pointer truncate"
                    >
                      {cat.nome}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Situação */}
            {situacaoOptions.length > 0 && (
              <div className="space-y-2">
                <Label>Situação</Label>
                <div className="space-y-1.5">
                  {situacaoOptions.map((s) => (
                    <div key={s.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`sit-${s.value}`}
                        checked={draft.situacoes.includes(s.value)}
                        onCheckedChange={() => toggleSituacao(s.value)}
                      />
                      <label htmlFor={`sit-${s.value}`} className="text-sm cursor-pointer">
                        {s.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formas de pagamento */}
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <div className="space-y-1.5">
                {formas.map((fp) => (
                  <div key={fp.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`fp-${fp.id}`}
                      checked={draft.formaPagamentoIds.includes(fp.id)}
                      onCheckedChange={() => toggleForma(fp.id)}
                    />
                    <label htmlFor={`fp-${fp.id}`} className="text-sm cursor-pointer">
                      {fp.nome}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label>Faixa de valor</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Mínimo"
                  value={draft.valorMin ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      valorMin: e.target.value ? Number(e.target.value) : undefined
                    }))
                  }
                  className="w-full"
                />
                <span className="text-muted-foreground text-sm shrink-0">até</span>
                <Input
                  type="number"
                  placeholder="Máximo"
                  value={draft.valorMax ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      valorMax: e.target.value ? Number(e.target.value) : undefined
                    }))
                  }
                  className="w-full"
                />
              </div>
            </div>

            {/* Vencimento */}
            <div className="space-y-2">
              <Label>Período de vencimento</Label>
              <DateRangePicker
                value={draft.vencimento}
                onChange={(r) => setDraft((d) => ({ ...d, vencimento: r }))}
                placeholder="Selecionar vencimento"
                className="w-full"
              />
            </div>

            {/* Emissão */}
            <div className="space-y-2">
              <Label>Período de emissão</Label>
              <DateRangePicker
                value={draft.emissao}
                onChange={(r) => setDraft((d) => ({ ...d, emissao: r }))}
                placeholder="Selecionar emissão"
                className="w-full"
              />
            </div>

            {/* Marcador */}
            <div className="space-y-2">
              <Label>Marcador</Label>
              <Input
                placeholder="Ex: urgente, pendente..."
                value={draft.marcador ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, marcador: e.target.value || undefined }))
                }
              />
            </div>
          </div>

          <SheetFooter className="gap-2 flex-row">
            <Button variant="ghost" onClick={clearAll} className="flex-1">
              <X className="h-4 w-4" />
              Limpar tudo
            </Button>
            <Button onClick={applyFilters} className="flex-1">
              Aplicar filtros
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Active chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="flex items-center gap-1 pl-2 pr-1 py-1 text-xs"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Remover filtro: ${chip.label}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          {chips.length > 1 && (
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Limpar todos
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { DEFAULT_FILTERS };
