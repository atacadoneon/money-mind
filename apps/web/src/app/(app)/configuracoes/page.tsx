"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Puzzle, Users, Settings2, CreditCard, Eye, EyeOff, Plus, Trash2, Shield, Webhook } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany
} from "@/hooks/use-companies";
import {
  useIntegracoes,
  useSaveIntegracoes,
  useMembros,
  useInviteMembro,
  useUpdateMembroRole,
  useRemoveMembro
} from "@/hooks/use-configuracoes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Empresa } from "@/types";
import type { UserMembro } from "@/lib/api/configuracoes.api";

/* ─── Tab Empresas ─── */
const empresaSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cnpj: z.string().optional()
});

type EmpresaForm = z.infer<typeof empresaSchema>;

function EmpresaModal({
  open,
  onOpenChange,
  empresa
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa?: Empresa | null;
}) {
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const isPending = create.isPending || update.isPending;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmpresaForm>({
    resolver: zodResolver(empresaSchema)
  });

  React.useEffect(() => {
    if (open) reset(empresa ? { nome: empresa.nome, cnpj: empresa.cnpj ?? "" } : { nome: "", cnpj: "" });
  }, [open, empresa, reset]);

  const onSubmit = async (values: EmpresaForm) => {
    if (empresa) {
      await update.mutateAsync({ id: empresa.id, payload: values });
    } else {
      await create.mutateAsync(values);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{empresa ? "Editar empresa" : "Nova empresa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input {...register("nome")} />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>CNPJ</Label>
            <Input {...register("cnpj")} placeholder="00.000.000/0001-00" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TabEmpresas() {
  const q = useCompanies();
  const del = useDeleteCompany();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editEmpresa, setEditEmpresa] = React.useState<Empresa | null>(null);

  const empresas = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditEmpresa(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Nova empresa
        </Button>
      </div>
      {q.isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{e.cnpj ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => { setEditEmpresa(e); setModalOpen(true); }}>Editar</Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Excluir ${e.nome}?`)) del.mutate(e.id); }}>
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
      <EmpresaModal open={modalOpen} onOpenChange={setModalOpen} empresa={editEmpresa} />
    </div>
  );
}

/* ─── Tab Integrações ─── */
function MaskedField({ label, description, fieldKey, value, onChange }: {
  label: string;
  description?: string;
  fieldKey: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Cole o token aqui..."
          className="pr-10"
        />
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          onClick={() => setVisible((v) => !v)}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function TabIntegracoes() {
  const q = useIntegracoes();
  const save = useSaveIntegracoes();

  const [tiny, setTiny] = React.useState("");
  const [contaSimples, setContaSimples] = React.useState("");
  const [pagarMeKey, setPagarMeKey] = React.useState("");
  const [pagarMeEnc, setPagarMeEnc] = React.useState("");

  React.useEffect(() => {
    if (q.data) {
      setTiny(q.data.tinyApiToken ?? "");
      setContaSimples(q.data.contaSimplesToken ?? "");
      setPagarMeKey(q.data.pagarMeApiKey ?? "");
      setPagarMeEnc(q.data.pagarMeEncryptionKey ?? "");
    }
  }, [q.data]);

  const handleSave = () => {
    save.mutate({
      tinyApiToken: tiny || undefined,
      contaSimplesToken: contaSimples || undefined,
      pagarMeApiKey: pagarMeKey || undefined,
      pagarMeEncryptionKey: pagarMeEnc || undefined
    });
  };

  if (q.isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tiny ERP / Olist</CardTitle>
          <CardDescription>Sincronização de pedidos, NF-e e clientes</CardDescription>
        </CardHeader>
        <CardContent>
          <MaskedField label="API Token" description="Encontre em Tiny ERP > Configurações > API" fieldKey="tiny" value={tiny} onChange={setTiny} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conta Simples</CardTitle>
          <CardDescription>Conta bancária PJ — saldo e extrato automático</CardDescription>
        </CardHeader>
        <CardContent>
          <MaskedField label="Token de acesso" fieldKey="contaSimples" value={contaSimples} onChange={setContaSimples} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagar.me</CardTitle>
          <CardDescription>Gateway de pagamentos — cobranças e transações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <MaskedField label="API Key" description="Chave de produção (sk_...)" fieldKey="pagarMeKey" value={pagarMeKey} onChange={setPagarMeKey} />
          <MaskedField label="Encryption Key" fieldKey="pagarMeEnc" value={pagarMeEnc} onChange={setPagarMeEnc} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar integrações"}
        </Button>
      </div>
    </div>
  );
}

/* ─── Tab Usuários ─── */
const ROLE_LABELS: Record<UserMembro["role"], string> = {
  owner: "Proprietário",
  admin: "Administrador",
  accountant: "Contador",
  viewer: "Visualizador"
};

const inviteSchema = z.object({
  email: z.string().email("E-mail inválido"),
  role: z.enum(["admin", "accountant", "viewer"])
});

type InviteForm = z.infer<typeof inviteSchema>;

function TabUsuarios() {
  const q = useMembros();
  const invite = useInviteMembro();
  const updateRole = useUpdateMembroRole();
  const remove = useRemoveMembro();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "viewer" }
  });

  const onInvite = async (values: InviteForm) => {
    await invite.mutateAsync(values);
    reset();
  };

  const membros = q.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Convidar membro</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onInvite)} className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label>E-mail</Label>
              <Input type="email" {...register("email")} placeholder="usuario@empresa.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Papel</Label>
              <Select value={watch("role")} onValueChange={(v) => setValue("role", v as InviteForm["role"])}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="accountant">Contador</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? "Enviando..." : "Convidar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {q.isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membros.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <p className="font-medium">{m.nome}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </TableCell>
                  <TableCell>
                    {m.role === "owner" ? (
                      <Badge variant="default">{ROLE_LABELS[m.role]}</Badge>
                    ) : (
                      <Select
                        value={m.role}
                        onValueChange={(v) => updateRole.mutate({ id: m.id, role: v as UserMembro["role"] })}
                      >
                        <SelectTrigger className="w-36 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="accountant">Contador</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.ativo ? "success" : "secondary"}>
                      {m.ativo ? "Ativo" : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {m.role !== "owner" && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Remover ${m.nome}?`)) remove.mutate(m.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
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
  );
}

/* ─── Main page ─── */
export default function ConfiguracoesPage() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="Configurações" description="Gerencie empresas, integrações e usuários" />

      <div className="p-6">
        <Tabs defaultValue="empresas">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="empresas">
              <Building2 className="h-4 w-4 mr-1.5" /> Empresas
            </TabsTrigger>
            <TabsTrigger value="integracoes">
              <Puzzle className="h-4 w-4 mr-1.5" /> Integrações
            </TabsTrigger>
            <TabsTrigger value="usuarios">
              <Users className="h-4 w-4 mr-1.5" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="plano">
              <CreditCard className="h-4 w-4 mr-1.5" /> Plano
            </TabsTrigger>
            <TabsTrigger value="webhooks" onClick={() => router.push("/configuracoes/webhooks")}>
              <Webhook className="h-4 w-4 mr-1.5" /> Webhooks
            </TabsTrigger>
            <TabsTrigger value="lgpd" onClick={() => router.push("/configuracoes/lgpd")}>
              <Shield className="h-4 w-4 mr-1.5" /> LGPD
            </TabsTrigger>
          </TabsList>

          <TabsContent value="empresas">
            <TabEmpresas />
          </TabsContent>

          <TabsContent value="integracoes">
            <TabIntegracoes />
          </TabsContent>

          <TabsContent value="usuarios">
            <TabUsuarios />
          </TabsContent>

          <TabsContent value="plano">
            <Card>
              <CardHeader>
                <CardTitle>Seu plano atual</CardTitle>
                <CardDescription>
                  Gerencie sua assinatura e limites de uso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <Settings2 className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold">Plano BPO Profissional</p>
                    <p className="text-sm text-muted-foreground">
                      Multi-empresa, conciliação automática, relatórios avançados
                    </p>
                  </div>
                  <Badge variant="success" className="ml-auto">Ativo</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Para alterar seu plano, entre em contato com o suporte.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
