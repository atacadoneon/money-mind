"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
// Collapsible removed — using inline state for expand/collapse
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { MessageSquare, Mail, Smartphone, Eye, Send, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";

type Canal = "whatsapp" | "email" | "sms";

const CANAL_CONFIG: Record<Canal, { icon: React.ElementType; label: string }> = {
  whatsapp: { icon: MessageSquare, label: "WhatsApp" },
  email: { icon: Mail, label: "E-mail" },
  sms: { icon: Smartphone, label: "SMS" }
};

const PLACEHOLDERS = [
  "{nome_cliente}", "{valor}", "{vencimento}", "{documento}", "{link_pagamento}", "{empresa}"
];

interface CobrancaTemplate {
  id: string;
  canal: Canal;
  nome: string;
  assunto?: string;
  corpo: string;
}

interface ReguaStep {
  id: string;
  dias: number;
  sentido: "antes" | "depois";
  canal: Canal;
  templateId: string;
}

interface EnvioHistorico {
  id: string;
  contaReceberNome: string;
  contaReceberValor: number;
  canal: Canal;
  status: "enviado" | "falhou" | "entregue" | "lido";
  destinatario: string;
  conteudo: string;
  criadoEm: string;
}

const templateSchema = z.object({
  canal: z.enum(["whatsapp", "email", "sms"]),
  nome: z.string().min(1, "Nome obrigatório"),
  assunto: z.string().optional(),
  corpo: z.string().min(1, "Corpo obrigatório")
});
type TemplateForm = z.infer<typeof templateSchema>;

function TabTemplates() {
  const qc = useQueryClient();
  const [previewBody, setPreviewBody] = React.useState("");
  const [canalSel, setCanalSel] = React.useState<Canal>("whatsapp");
  const [loading, setLoading] = React.useState(false);

  const templatesQ = useQuery({
    queryKey: ["cobranca-templates"],
    queryFn: async () => {
      try {
        const { data } = await api.get<CobrancaTemplate[]>("/cobranca/templates");
        return data ?? [];
      } catch { return []; }
    }
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<TemplateForm>({
      resolver: zodResolver(templateSchema),
      defaultValues: { canal: "whatsapp", nome: "", corpo: "" }
    });

  const corpo = watch("corpo");
  const canal = watch("canal");

  const insertPlaceholder = (ph: string) => {
    setValue("corpo", (corpo ?? "") + ph);
  };

  const onSubmit = async (values: TemplateForm) => {
    setLoading(true);
    try {
      await api.post("/cobranca/templates", values);
      qc.invalidateQueries({ queryKey: ["cobranca-templates"] });
      toast.success("Template criado");
      reset();
    } catch {
      toast.error("Erro ao criar template");
    } finally {
      setLoading(false);
    }
  };

  const delTemplate = async (id: string) => {
    try {
      await api.delete(`/cobranca/templates/${id}`);
      qc.invalidateQueries({ queryKey: ["cobranca-templates"] });
      toast.success("Template removido");
    } catch {
      toast.error("Erro ao remover");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle>Novo template</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Canal *</Label>
              <Select value={canal} onValueChange={(v) => setValue("canal", v as Canal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CANAL_CONFIG) as [Canal, typeof CANAL_CONFIG[Canal]][]).map(
                    ([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <v.icon className="h-4 w-4" /> {v.label}
                        </span>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input {...register("nome")} placeholder="Ex: Lembrete D-3" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>

            {canal === "email" && (
              <div className="space-y-1">
                <Label>Assunto</Label>
                <Input {...register("assunto")} placeholder="Lembrete de pagamento" />
              </div>
            )}

            <div className="space-y-1">
              <Label>Corpo *</Label>
              <Textarea
                {...register("corpo")}
                placeholder="Olá {nome_cliente}, seu boleto de {valor} vence em {vencimento}..."
                className="min-h-28 font-mono text-sm"
              />
              {errors.corpo && <p className="text-xs text-destructive">{errors.corpo.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Placeholders disponíveis</Label>
              <div className="flex flex-wrap gap-1">
                {PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(ph)}
                    className="rounded bg-muted px-2 py-0.5 font-mono text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>

            {corpo && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Preview (dados de exemplo)
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {corpo
                    .replace("{nome_cliente}", "João Silva")
                    .replace("{valor}", "R$ 1.500,00")
                    .replace("{vencimento}", "20/04/2026")
                    .replace("{documento}", "NF-001")
                    .replace("{link_pagamento}", "https://pay.me/abc123")
                    .replace("{empresa}", "Money Mind BPO")}
                </p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Plus className="h-4 w-4 mr-2" /> Criar template
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-3">
        <h3 className="font-medium">Templates cadastrados</h3>
        {templatesQ.isLoading ? (
          <Skeleton className="h-32" />
        ) : (templatesQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum template cadastrado</p>
        ) : (
          (templatesQ.data ?? []).map((t) => {
            const cfg = CANAL_CONFIG[t.canal];
            const Icon = cfg.icon;
            return (
              <Card key={t.id}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="font-medium text-sm">{t.nome}</p>
                      <Badge variant="secondary" className="text-[10px]">{cfg.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.corpo}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm("Excluir template?")) delTemplate(t.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function TabRegua() {
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [dias, setDias] = React.useState("3");
  const [sentido, setSentido] = React.useState<"antes" | "depois">("antes");
  const [canal, setCanal] = React.useState<Canal>("whatsapp");
  const [templateId, setTemplateId] = React.useState("");

  const templatesQ = useQuery({
    queryKey: ["cobranca-templates"],
    queryFn: async () => {
      try {
        const { data } = await api.get<CobrancaTemplate[]>("/cobranca/templates");
        return data ?? [];
      } catch { return []; }
    }
  });

  const reguaQ = useQuery({
    queryKey: ["cobranca-regua"],
    queryFn: async () => {
      try {
        const { data } = await api.get<ReguaStep[]>("/cobranca/regua");
        return data ?? [];
      } catch { return []; }
    }
  });

  const addStep = async () => {
    if (!templateId) { toast.error("Selecione um template"); return; }
    setLoading(true);
    try {
      await api.post("/cobranca/regua", {
        dias: Number(dias),
        sentido,
        canal,
        templateId
      });
      qc.invalidateQueries({ queryKey: ["cobranca-regua"] });
      toast.success("Passo adicionado à régua");
    } catch {
      toast.error("Erro ao adicionar passo");
    } finally {
      setLoading(false);
    }
  };

  const delStep = async (id: string) => {
    try {
      await api.delete(`/cobranca/regua/${id}`);
      qc.invalidateQueries({ queryKey: ["cobranca-regua"] });
    } catch {
      toast.error("Erro ao remover passo");
    }
  };

  const templates = templatesQ.data ?? [];
  const steps = reguaQ.data ?? [];
  const sortedSteps = [...steps].sort((a, b) => {
    const va = a.sentido === "antes" ? -a.dias : a.dias;
    const vb = b.sentido === "antes" ? -b.dias : b.dias;
    return va - vb;
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar passo à régua</CardTitle>
          <CardDescription>Configure quando e como o cliente será notificado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Dias *</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Momento</Label>
              <Select value={sentido} onValueChange={(v) => setSentido(v as "antes" | "depois")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="antes">Antes do vencimento</SelectItem>
                  <SelectItem value="depois">Após o vencimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Canal</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v as Canal)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(CANAL_CONFIG) as [Canal, typeof CANAL_CONFIG[Canal]][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.filter((t) => t.canal === canal).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={addStep} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Plus className="h-4 w-4 mr-2" /> Adicionar passo
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-medium">Régua de cobrança configurada</h3>
        {reguaQ.isLoading ? (
          <Skeleton className="h-32" />
        ) : sortedSteps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum passo configurado</p>
        ) : (
          <div className="space-y-2">
            {sortedSteps.map((s) => {
              const cfg = CANAL_CONFIG[s.canal];
              const Icon = cfg.icon;
              const tmpl = templates.find((t) => t.id === s.templateId);
              return (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${s.sentido === "antes" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                        {s.sentido === "antes" ? `-${s.dias}d` : `+${s.dias}d`}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{cfg.label}</span>
                          <span className="text-xs text-muted-foreground">
                            — {s.dias} dias {s.sentido === "antes" ? "antes" : "após"} vencimento
                          </span>
                        </div>
                        {tmpl && <p className="text-xs text-muted-foreground mt-0.5">{tmpl.nome}</p>}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => delStep(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoricoRow({ h }: { h: EnvioHistorico }) {
  const [expanded, setExpanded] = React.useState(false);
  const cfg = CANAL_CONFIG[h.canal];
  const Icon = cfg.icon;
  const STATUS_BADGE: Record<EnvioHistorico["status"], "success" | "destructive" | "secondary" | "outline"> = {
    enviado: "secondary",
    entregue: "success",
    lido: "success",
    falhou: "destructive"
  };

  return (
    <>
      <TableRow>
        <TableCell className="text-sm">
          <p className="font-medium truncate max-w-[160px]">{h.contaReceberNome}</p>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 text-xs">
            <Icon className="h-3.5 w-3.5" /> {cfg.label}
          </div>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{h.destinatario}</TableCell>
        <TableCell>
          <Badge variant={STATUS_BADGE[h.status]} className="capitalize text-xs">
            {h.status}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{formatDate(h.criadoEm)}</TableCell>
        <TableCell>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6}>
            <pre className="text-xs bg-muted rounded p-2 whitespace-pre-wrap">{h.conteudo}</pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function TabHistorico() {
  const historicoQ = useQuery({
    queryKey: ["cobranca-historico"],
    queryFn: async () => {
      try {
        const { data } = await api.get<EnvioHistorico[]>("/cobranca/historico?limit=100");
        return data ?? [];
      } catch { return []; }
    }
  });

  const historico = historicoQ.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de envios</CardTitle>
      </CardHeader>
      <CardContent>
        {historicoQ.isLoading ? (
          <Skeleton className="h-48" />
        ) : historico.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum envio registrado
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta a receber</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((h) => (
                  <HistoricoRow key={h.id} h={h} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CobrancaReguaPage() {
  const [sending, setSending] = React.useState(false);

  const forceManual = async () => {
    const crId = window.prompt("ID da Conta a Receber para forçar envio:");
    if (!crId) return;
    setSending(true);
    try {
      await api.post(`/cobranca/forcar-envio/${crId}`);
      toast.success("Envio agendado");
    } catch {
      toast.error("Erro ao forçar envio");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Régua de cobrança"
        description="Configure templates, régua de envio automático e acompanhe o histórico"
        actions={
          <Button variant="outline" size="sm" onClick={forceManual} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Forçar envio manual
          </Button>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="templates">
          <TabsList className="mb-6">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="regua">Régua</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <TabTemplates />
          </TabsContent>
          <TabsContent value="regua">
            <TabRegua />
          </TabsContent>
          <TabsContent value="historico">
            <TabHistorico />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
