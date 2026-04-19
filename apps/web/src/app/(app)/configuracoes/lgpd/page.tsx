"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";
import { formatDate } from "@/lib/format";
import { Download, Trash2, Shield, ExternalLink, Loader2, ToggleLeft, ToggleRight } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  entidade: string;
  entidadeId: string;
  ip?: string;
  criadoEm: string;
}

type ConsentType = "cookies_essenciais" | "analytics" | "marketing" | "ai_processing";

interface ConsentState {
  accepted: boolean;
  updatedAt: string | null;
}

const CONSENT_LABELS: Record<ConsentType, { label: string; description: string; required?: boolean }> = {
  cookies_essenciais: {
    label: "Cookies essenciais",
    description: "Necessários para o funcionamento da plataforma. Não podem ser desativados.",
    required: true,
  },
  analytics: {
    label: "Analytics e performance",
    description: "Ajudam a entender como você usa a plataforma para melhorarmos a experiência.",
  },
  marketing: {
    label: "Marketing e comunicações",
    description: "Permitem enviar novidades, dicas e ofertas relevantes por e-mail.",
  },
  ai_processing: {
    label: "Processamento por IA",
    description: "Autoriza o uso de dados financeiros para sugestões e automações com Inteligência Artificial.",
  },
};

function AuditLogTab() {
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    api
      .get<{ data: AuditEntry[] }>("/lgpd/audit/me?limit=50")
      .then((r) => setEntries(r.data?.data ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <Skeleton className="h-48" />;

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nenhum registro de auditoria encontrado nos últimos 90 dias.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ação</TableHead>
            <TableHead>Entidade</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs">{e.action}</TableCell>
              <TableCell className="text-sm">{e.entidade} #{e.entidadeId?.slice(0, 8)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{e.ip ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(e.criadoEm)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ConsentosTab() {
  const [consents, setConsents] = React.useState<Record<ConsentType, ConsentState>>({
    cookies_essenciais: { accepted: true, updatedAt: null },
    analytics: { accepted: false, updatedAt: null },
    marketing: { accepted: false, updatedAt: null },
    ai_processing: { accepted: false, updatedAt: null },
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<ConsentType | null>(null);

  React.useEffect(() => {
    api
      .get<Record<ConsentType, ConsentState>>("/lgpd/consent")
      .then((r) => setConsents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (type: ConsentType) => {
    if (CONSENT_LABELS[type].required) return;
    const newValue = !consents[type].accepted;
    setSaving(type);
    try {
      await api.post("/lgpd/consent", { type, accepted: newValue });
      setConsents((prev) => ({ ...prev, [type]: { accepted: newValue, updatedAt: new Date().toISOString() } }));
      toast.success(`Preferência de ${CONSENT_LABELS[type].label} atualizada.`);
    } catch {
      toast.error("Erro ao atualizar preferência.");
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      {(Object.entries(CONSENT_LABELS) as [ConsentType, (typeof CONSENT_LABELS)[ConsentType]][]).map(([type, config]) => {
        const state = consents[type];
        const isOn = state.accepted;
        return (
          <div key={type} className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
            <div className="flex-1">
              <p className="font-medium text-sm flex items-center gap-2">
                {config.label}
                {config.required && <Badge variant="secondary" className="text-xs">Obrigatório</Badge>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
              {state.updatedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Atualizado em {formatDate(state.updatedAt)}
                </p>
              )}
            </div>
            <button
              disabled={config.required || saving === type}
              onClick={() => toggle(type)}
              className="shrink-0 disabled:opacity-40"
              aria-label={`${isOn ? "Desativar" : "Ativar"} ${config.label}`}
            >
              {saving === type ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : isOn ? (
                <ToggleRight className="h-7 w-7 text-primary" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-muted-foreground" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function LgpdPage() {
  const user = useAuthStore((s) => s.user);
  const [exportLoading, setExportLoading] = React.useState(false);
  const [exportStatus, setExportStatus] = React.useState<"idle" | "pending" | "done">("idle");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  const requestExport = async () => {
    if (!user?.id) return;
    setExportLoading(true);
    setExportStatus("pending");
    try {
      await api.post("/lgpd/export-request");
      toast.success("Solicitação de exportação registrada. Você receberá um e-mail com o link em até 24 horas.");
      setExportStatus("done");
    } catch {
      toast.error("Erro ao solicitar exportação");
      setExportStatus("idle");
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!user?.id) return;
    setDeleteLoading(true);
    try {
      await api.post("/lgpd/erasure-request");
      toast.success("Solicitação de exclusão enviada. Seus dados serão apagados em 30 dias.");
      setDeleteOpen(false);
      setDeleteConfirm(false);
    } catch {
      toast.error("Erro ao solicitar exclusão");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Privacidade e LGPD"
        description="Gerencie seus dados pessoais conforme a Lei Geral de Proteção de Dados"
      />

      <div className="p-6 space-y-6 max-w-3xl">
        <Tabs defaultValue="dados">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="dados">Meus dados</TabsTrigger>
            <TabsTrigger value="consentimentos">Consentimentos</TabsTrigger>
            <TabsTrigger value="auditoria">Audit log</TabsTrigger>
            <TabsTrigger value="conta">Apagar conta</TabsTrigger>
          </TabsList>

          {/* ─── Meus Dados ─── */}
          <TabsContent value="dados" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-4 w-4" /> Exportar meus dados
                </CardTitle>
                <CardDescription>
                  Baixe todos os seus dados pessoais armazenados no sistema em formato JSON (LGPD Art. 18)
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={requestExport}
                  disabled={exportLoading || exportStatus === "done"}
                >
                  {exportLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {exportStatus === "done"
                    ? "Solicitação enviada"
                    : exportLoading
                    ? "Solicitando..."
                    : "Solicitar exportação"}
                </Button>
                {exportStatus === "pending" && <Badge variant="secondary">Processando...</Badge>}
                {exportStatus === "done" && <Badge className="bg-green-100 text-green-700 border-green-200">E-mail enviado</Badge>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Documentos legais
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {[
                  { href: "/privacidade", label: "Política de Privacidade" },
                  { href: "/termos", label: "Termos de Uso" },
                  { href: "/cookies", label: "Política de Cookies" },
                  { href: "/seguranca", label: "Política de Segurança" },
                  { href: "/dpa", label: "DPA — Acordo de Tratamento de Dados" },
                  { href: "/dpo", label: "Contatar o DPO" },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {link.label}
                  </a>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Consentimentos ─── */}
          <TabsContent value="consentimentos">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar consentimentos</CardTitle>
                <CardDescription>
                  Controle como seus dados são usados dentro da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConsentosTab />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Audit Log ─── */}
          <TabsContent value="auditoria">
            <Card>
              <CardHeader>
                <CardTitle>Registro de auditoria</CardTitle>
                <CardDescription>
                  Histórico de ações realizadas com sua conta nos últimos 90 dias
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AuditLogTab />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Apagar Conta ─── */}
          <TabsContent value="conta">
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" /> Apagar minha conta
                </CardTitle>
                <CardDescription>
                  Solicite a exclusão permanente de todos os seus dados pessoais. Você terá 30 dias para reverter esta decisão.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 text-sm">
                  <p className="font-medium text-destructive mb-1">Atenção — esta ação é grave</p>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Seus dados serão anonimizados após 30 dias</li>
                    <li>Dados fiscais obrigatórios são retidos por 5 anos (obrigação legal)</li>
                    <li>Você perderá acesso a todas as funcionalidades imediatamente</li>
                    <li>Assinaturas ativas serão canceladas</li>
                  </ul>
                </div>
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Solicitar exclusão da conta
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(v) => { setDeleteOpen(v); if (!v) setDeleteConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão da conta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá solicitar a exclusão permanente de todos os seus dados pessoais.
              O processo é agendado para 30 dias a partir de hoje, conforme previsto na LGPD.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!deleteConfirm ? (
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => { e.preventDefault(); setDeleteConfirm(true); }}
              >
                Continuar
              </AlertDialogAction>
            </AlertDialogFooter>
          ) : (
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirm(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
              >
                {deleteLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Sim, quero apagar minha conta
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
