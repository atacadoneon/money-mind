"use client";

import * as React from "react";
import { BarChart3, TrendingUp, TrendingDown, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  useRelatorioDRE,
  useRelatorioFluxoCaixa,
  useRelatorioContasPorCategoria,
  useRelatorioTopContatos
} from "@/hooks/use-relatorios";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCompanies } from "@/hooks/use-companies";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format } from "date-fns";

const COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#eab308", "#a855f7", "#f97316", "#ec4899", "#6b7280"];

function getPrimeiroUltimoMes(): { inicio: string; fim: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    inicio: `${y}-${m}-01`,
    fim: `${y}-${m}-${lastDay}`
  };
}

function TabDRE({ empresaId }: { empresaId?: string }) {
  const defaults = getPrimeiroUltimoMes();
  const [dateRange, setDateRange] = React.useState({
    from: new Date(defaults.inicio),
    to: new Date(defaults.fim)
  });
  const [params, setParams] = React.useState({ inicio: defaults.inicio, fim: defaults.fim, empresaId });

  const q = useRelatorioDRE(params);
  const dre = q.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <DateRangePicker
          value={dateRange}
          onChange={(r) => setDateRange({ from: r.from ?? new Date(defaults.inicio), to: r.to ?? new Date(defaults.fim) })}
          placeholder="Selecionar período"
        />
        <Button
          onClick={() =>
            setParams({
              inicio: format(dateRange.from, "yyyy-MM-dd"),
              fim: format(dateRange.to, "yyyy-MM-dd"),
              empresaId
            })
          }
        >
          Gerar DRE
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const p = new URLSearchParams({
                inicio: format(dateRange.from, "yyyy-MM-dd"),
                fim: format(dateRange.to, "yyyy-MM-dd"),
                ...(empresaId ? { empresa_id: empresaId } : {})
              });
              const { default: axios } = await import("axios");
              const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/relatorios/dre.pdf?${p}`,
                { responseType: "blob" }
              );
              const url = URL.createObjectURL(res.data);
              const a = document.createElement("a");
              a.href = url;
              a.download = `dre-${format(dateRange.from, "yyyy-MM")}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
            } catch {
              alert("PDF ainda não disponível — aguarde o backend");
            }
          }}
        >
          <Download className="h-4 w-4 mr-2" /> Exportar PDF
        </Button>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64" />
      ) : !dre ? null : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">Receitas</p>
                  <p className="text-xl font-bold text-success">
                    {formatCurrency(dre.totalReceitas)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Despesas</p>
                  <p className="text-xl font-bold text-destructive">
                    {formatCurrency(dre.totalDespesas)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Resultado</p>
                  <p
                    className={`text-xl font-bold ${
                      dre.resultado >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatCurrency(dre.resultado)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2 text-left font-medium">Categoria</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {dre.linhas.map((l) => (
                  <tr key={l.categoriaId} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2">{l.categoriaNome}</td>
                    <td className="px-4 py-2 capitalize text-muted-foreground">{l.tipo}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatCurrency(l.total)}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {l.percentual.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TabFluxoCaixa({ empresaId }: { empresaId?: string }) {
  const [dias, setDias] = React.useState<30 | 60 | 90>(30);
  const q = useRelatorioFluxoCaixa({ dias, empresaId });
  const data = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {([30, 60, 90] as const).map((d) => (
          <Button
            key={d}
            variant={dias === d ? "default" : "outline"}
            size="sm"
            onClick={() => setDias(d)}
          >
            {d} dias
          </Button>
        ))}
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Fluxo de caixa — próximos {dias} dias</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="data"
                  tickFormatter={(v) => formatDate(v, "dd/MM")}
                  fontSize={11}
                />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} fontSize={11} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(v) => formatDate(v)} />
                <Legend />
                <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="saldoAcumulado" name="Saldo acumulado" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TabCategorias({ empresaId }: { empresaId?: string }) {
  const defaults = getPrimeiroUltimoMes();
  const [tipo, setTipo] = React.useState<"despesa" | "receita">("despesa");
  const [dateRange, setDateRange] = React.useState({
    from: new Date(defaults.inicio),
    to: new Date(defaults.fim)
  });
  const [params, setParams] = React.useState({ tipo: "despesa" as "despesa" | "receita", inicio: defaults.inicio, fim: defaults.fim, empresaId });

  const q = useRelatorioContasPorCategoria(params);
  const data = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={tipo} onValueChange={(v) => setTipo(v as "despesa" | "receita")}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="despesa">Despesas</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
          </SelectContent>
        </Select>
        <DateRangePicker
          value={dateRange}
          onChange={(r) => setDateRange({ from: r.from ?? new Date(defaults.inicio), to: r.to ?? new Date(defaults.fim) })}
          placeholder="Selecionar período"
        />
        <Button
          onClick={() =>
            setParams({
              tipo,
              inicio: format(dateRange.from, "yyyy-MM-dd"),
              fim: format(dateRange.to, "yyyy-MM-dd"),
              empresaId
            })
          }
        >
          Filtrar
        </Button>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64" />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados para o período selecionado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{tipo === "despesa" ? "Despesas" : "Receitas"} por categoria</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="total"
                    nameKey="categoriaNome"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ranking por valor</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} fontSize={11} />
                  <YAxis type="category" dataKey="categoriaNome" width={120} fontSize={11} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function TabTopContatos({ empresaId }: { empresaId?: string }) {
  const defaults = getPrimeiroUltimoMes();
  const [tipoContato, setTipoContato] = React.useState<"fornecedor" | "cliente">("fornecedor");
  const [dateRange, setDateRange] = React.useState({
    from: new Date(defaults.inicio),
    to: new Date(defaults.fim)
  });
  const [params, setParams] = React.useState({ tipo: "fornecedor" as "fornecedor" | "cliente", inicio: defaults.inicio, fim: defaults.fim, empresaId });

  const q = useRelatorioTopContatos(params);
  const data = (q.data ?? []).slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={tipoContato} onValueChange={(v) => setTipoContato(v as "fornecedor" | "cliente")}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fornecedor">Fornecedores</SelectItem>
            <SelectItem value="cliente">Clientes</SelectItem>
          </SelectContent>
        </Select>
        <DateRangePicker
          value={dateRange}
          onChange={(r) => setDateRange({ from: r.from ?? new Date(defaults.inicio), to: r.to ?? new Date(defaults.fim) })}
          placeholder="Selecionar período"
        />
        <Button
          onClick={() =>
            setParams({
              tipo: tipoContato,
              inicio: format(dateRange.from, "yyyy-MM-dd"),
              fim: format(dateRange.to, "yyyy-MM-dd"),
              empresaId
            })
          }
        >
          Filtrar
        </Button>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64" />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados para o período selecionado.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Top 10 {tipoContato === "fornecedor" ? "fornecedores" : "clientes"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} fontSize={11} />
                <YAxis type="category" dataKey="contatoNome" width={150} fontSize={11} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="total" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function RelatoriosPage() {
  const [empresaId, setEmpresaId] = React.useState<string | undefined>(undefined);
  const empresasQ = useCompanies();
  const empresas = empresasQ.data ?? [];

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="DRE, fluxo de caixa e análises financeiras"
        actions={
          <Select value={empresaId ?? "todas"} onValueChange={(v) => setEmpresaId(v === "todas" ? undefined : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas empresas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="dre">
          <TabsList className="mb-6">
            <TabsTrigger value="dre">DRE</TabsTrigger>
            <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
            <TabsTrigger value="categorias">Por categoria</TabsTrigger>
            <TabsTrigger value="contatos">Top contatos</TabsTrigger>
          </TabsList>

          <TabsContent value="dre">
            <TabDRE empresaId={empresaId} />
          </TabsContent>
          <TabsContent value="fluxo">
            <TabFluxoCaixa empresaId={empresaId} />
          </TabsContent>
          <TabsContent value="categorias">
            <TabCategorias empresaId={empresaId} />
          </TabsContent>
          <TabsContent value="contatos">
            <TabTopContatos empresaId={empresaId} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
