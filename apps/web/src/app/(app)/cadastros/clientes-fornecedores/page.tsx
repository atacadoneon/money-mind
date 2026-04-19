"use client";

import * as React from "react";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useContatos, useCreateContato, useUpdateContato, useDeleteContato } from "@/hooks/use-contatos";
import { formatCpfCnpj } from "@/lib/format";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Contato } from "@/types";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipos: z.array(z.string()).min(1, "Selecione pelo menos um papel"),
  cpfCnpj: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional()
});

type FormData = z.infer<typeof schema>;

const TIPO_LABELS: Record<string, string> = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  ambos: "Ambos"
};

const TIPO_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  cliente: "default",
  fornecedor: "secondary",
  ambos: "outline"
};

function tipoFromArray(tipos?: string[]): string {
  if (!tipos || tipos.length === 0) return "ambos";
  if (tipos.includes("cliente") && tipos.includes("fornecedor")) return "ambos";
  return tipos[0] ?? "ambos";
}

function tipoToArray(tipo: string): string[] {
  if (tipo === "ambos") return ["cliente", "fornecedor"];
  return [tipo];
}

function ContatoModal({
  open,
  onOpenChange,
  contato
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contato?: Contato | null;
}) {
  const create = useCreateContato();
  const update = useUpdateContato();
  const isPending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipos: ["cliente", "fornecedor"] }
  });

  React.useEffect(() => {
    if (open) {
      reset(
        contato
          ? {
              nome: contato.nome,
              tipos: contato.tipos ?? tipoToArray("ambos"),
              cpfCnpj: contato.cpfCnpj ?? "",
              email: contato.email ?? "",
              telefone: contato.telefone ?? ""
            }
          : { nome: "", tipos: ["cliente", "fornecedor"], cpfCnpj: "", email: "", telefone: "" }
      );
    }
  }, [open, contato, reset]);

  const onSubmit = async (values: FormData) => {
    if (contato) {
      await update.mutateAsync({ id: contato.id, payload: values });
    } else {
      await create.mutateAsync({ ...values, situacao: "ativo" });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{contato ? "Editar contato" : "Novo contato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" {...register("nome")} placeholder="Razão social ou nome completo" />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Papel *</Label>
            <Select
              value={tipoFromArray(watch("tipos"))}
              onValueChange={(v) => setValue("tipos", tipoToArray(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="fornecedor">Fornecedor</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cpfCnpj">CPF / CNPJ</Label>
            <Input id="cpfCnpj" {...register("cpfCnpj")} placeholder="000.000.000-00" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...register("email")} placeholder="contato@empresa.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" {...register("telefone")} placeholder="(11) 9 0000-0000" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientesFornecedoresPage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [tipoFilter, setTipoFilter] = React.useState<string>("todos");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editContato, setEditContato] = React.useState<Contato | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const filters = {
    search: debouncedSearch || undefined,
    tipo: tipoFilter !== "todos" ? tipoFilter : undefined,
    page: 1,
    pageSize: 50
  };

  const q = useContatos(filters);
  const del = useDeleteContato();

  const data = q.data?.data ?? [];
  const total = q.data?.total ?? 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = () =>
    setSelected((prev) => (prev.size === data.length ? new Set() : new Set(data.map((d) => d.id))));

  const openNew = () => {
    setEditContato(null);
    setModalOpen(true);
  };

  const openEdit = (c: Contato) => {
    setEditContato(c);
    setModalOpen(true);
  };

  const bulkDelete = async () => {
    if (!confirm(`Excluir ${selected.size} contatos?`)) return;
    for (const id of Array.from(selected)) await del.mutateAsync(id);
    setSelected(new Set());
  };

  return (
    <>
      <PageHeader
        title="Clientes e Fornecedores"
        description={`${total} contatos cadastrados`}
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo contato
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <Tabs value={tipoFilter} onValueChange={setTipoFilter}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="cliente">Clientes</TabsTrigger>
            <TabsTrigger value="fornecedor">Fornecedores</TabsTrigger>
            <TabsTrigger value="ambos">Ambos</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF, CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
            <span className="text-sm font-medium px-2">
              {selected.size} selecionado{selected.size > 1 ? "s" : ""}
            </span>
            <Button size="sm" variant="destructive" onClick={bulkDelete} disabled={del.isPending}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </div>
        )}

        {q.isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : q.isError ? (
          <EmptyState
            title="Erro ao carregar"
            description="Não foi possível buscar os contatos."
            action={<Button onClick={() => q.refetch()}>Tentar de novo</Button>}
          />
        ) : data.length === 0 ? (
          <EmptyState
            title="Nenhum contato encontrado"
            description="Cadastre clientes e fornecedores para usar em lançamentos."
            action={
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Novo contato
              </Button>
            }
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selected.size === data.length && data.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF / CNPJ</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={() => toggle(c.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/cadastros/clientes-fornecedores/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatCpfCnpj(c.cpfCnpj)}
                    </TableCell>
                    <TableCell>
                      {(() => { const t = tipoFromArray(c.tipos); return <Badge variant={TIPO_VARIANTS[t]}>{TIPO_LABELS[t]}</Badge>; })()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.telefone ?? "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Excluir este contato?")) del.mutate(c.id);
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
      </div>

      <ContatoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        contato={editContato}
      />
    </>
  );
}
