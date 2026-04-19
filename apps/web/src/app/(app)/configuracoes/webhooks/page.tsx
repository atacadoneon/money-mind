"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { Plus, Trash2, Pause, Play, RotateCcw, Webhook, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const WEBHOOK_EVENTS = [
  "conta_pagar.criada",
  "conta_pagar.paga",
  "conta_pagar.atrasada",
  "conta_receber.criada",
  "conta_receber.recebida",
  "conta_receber.atrasada",
  "conciliacao.confirmada",
  "sync.concluido",
  "sync.erro"
];

interface WebhookSub {
  id: string;
  url: string;
  eventos: string[];
  ativo: boolean;
  secret: string;
  criadoEm: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  evento: string;
  statusCode: number;
  sucesso: boolean;
  tentativas: number;
  criadoEm: string;
  payload?: string;
}

const webhookSchema = z.object({
  url: z.string().url("URL inválida"),
  eventos: z.array(z.string()).min(1, "Selecione pelo menos um evento")
});
type WebhookForm = z.infer<typeof webhookSchema>;

function generateSecret() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function CreateWebhookDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [secret] = React.useState(generateSecret);
  const [loading, setLoading] = React.useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } =
    useForm<WebhookForm>({
      resolver: zodResolver(webhookSchema),
      defaultValues: { url: "", eventos: [] }
    });

  const eventos = watch("eventos");

  const toggleEvento = (ev: string) => {
    const current = eventos ?? [];
    setValue(
      "eventos",
      current.includes(ev) ? current.filter((e) => e !== ev) : [...current, ev]
    );
  };

  const onSubmit = async (values: WebhookForm) => {
    setLoading(true);
    try {
      await api.post("/webhooks/subscriptions", { ...values, secret });
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook criado");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao criar webhook");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar webhook</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>URL de destino *</Label>
            <Input {...register("url")} placeholder="https://seu-sistema.com/webhook" />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Secret (auto-gerado)</Label>
            <Input readOnly value={secret} className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">
              Use este secret para validar a assinatura dos webhooks
            </p>
          </div>

          <div className="space-y-2">
            <Label>Eventos *</Label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {WEBHOOK_EVENTS.map((ev) => (
                <div key={ev} className="flex items-center gap-2">
                  <Checkbox
                    id={`ev-${ev}`}
                    checked={eventos?.includes(ev)}
                    onCheckedChange={() => toggleEvento(ev)}
                  />
                  <label htmlFor={`ev-${ev}`} className="text-xs cursor-pointer font-mono">
                    {ev}
                  </label>
                </div>
              ))}
            </div>
            {errors.eventos && (
              <p className="text-xs text-destructive">{errors.eventos.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar webhook
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeliveryRow({ delivery }: { delivery: WebhookDelivery }) {
  const [expanded, setExpanded] = React.useState(false);
  const qc = useQueryClient();

  const retry = async () => {
    try {
      await api.post(`/webhooks/deliveries/${delivery.id}/retry`);
      toast.success("Reenvio agendado");
      qc.invalidateQueries({ queryKey: ["webhooks", "deliveries"] });
    } catch {
      toast.error("Erro ao reenviar");
    }
  };

  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-xs">{delivery.evento}</TableCell>
        <TableCell>
          <Badge variant={delivery.sucesso ? "success" : "destructive"}>
            {delivery.statusCode}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{delivery.tentativas}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{formatDate(delivery.criadoEm)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            {!delivery.sucesso && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={retry}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            {delivery.payload && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded((v) => !v)}>
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && delivery.payload && (
        <TableRow>
          <TableCell colSpan={5}>
            <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-32">
              {delivery.payload}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);

  const subsQ = useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      try {
        const { data } = await api.get<WebhookSub[]>("/webhooks/subscriptions");
        return data ?? [];
      } catch { return []; }
    }
  });

  const deliveriesQ = useQuery({
    queryKey: ["webhooks", "deliveries"],
    queryFn: async () => {
      try {
        const { data } = await api.get<WebhookDelivery[]>("/webhooks/deliveries?limit=100");
        return data ?? [];
      } catch { return []; }
    }
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await api.patch(`/webhooks/subscriptions/${id}`, { ativo });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] })
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/webhooks/subscriptions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook removido");
    }
  });

  const subs = subsQ.data ?? [];
  const deliveries = deliveriesQ.data ?? [];

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Receba notificações em tempo real sobre eventos do sistema"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Criar webhook
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-4 w-4" /> Webhooks cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subsQ.isLoading ? (
              <Skeleton className="h-32" />
            ) : subs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum webhook cadastrado
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Eventos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-mono text-xs max-w-xs truncate">{w.url}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {w.eventos.slice(0, 3).map((e) => (
                              <Badge key={e} variant="secondary" className="text-[10px]">
                                {e}
                              </Badge>
                            ))}
                            {w.eventos.length > 3 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{w.eventos.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={w.ativo ? "success" : "secondary"}>
                            {w.ativo ? "Ativo" : "Pausado"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => toggleActive.mutate({ id: w.id, ativo: !w.ativo })}
                              title={w.ativo ? "Pausar" : "Ativar"}
                            >
                              {w.ativo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Excluir este webhook?")) deleteWebhook.mutate(w.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deliveries */}
        <Card>
          <CardHeader>
            <CardTitle>Entregas recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {deliveriesQ.isLoading ? (
              <Skeleton className="h-32" />
            ) : deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma entrega registrada
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((d) => (
                      <DeliveryRow key={d.id} delivery={d} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateWebhookDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
