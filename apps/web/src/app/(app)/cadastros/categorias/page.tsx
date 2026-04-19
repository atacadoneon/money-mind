"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useCategorias,
  useCreateCategoria,
  useUpdateCategoria,
  useDeleteCategoria
} from "@/hooks/use-categorias";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Categoria } from "@/types";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipo: z.enum(["receita", "despesa"]),
  cor: z.string().optional(),
  parentId: z.string().optional()
});

type FormData = z.infer<typeof schema>;

const COR_OPTIONS = [
  { label: "Azul", value: "#3b82f6" },
  { label: "Verde", value: "#22c55e" },
  { label: "Vermelho", value: "#ef4444" },
  { label: "Amarelo", value: "#eab308" },
  { label: "Roxo", value: "#a855f7" },
  { label: "Laranja", value: "#f97316" },
  { label: "Rosa", value: "#ec4899" },
  { label: "Cinza", value: "#6b7280" }
];

function CategoriaModal({
  open,
  onOpenChange,
  categoria,
  categorias
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoria?: Categoria | null;
  categorias: Categoria[];
}) {
  const create = useCreateCategoria();
  const update = useUpdateCategoria();
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
    defaultValues: { tipo: "despesa" }
  });

  React.useEffect(() => {
    if (open) {
      reset(
        categoria
          ? {
              nome: categoria.nome,
              tipo: categoria.tipo,
              cor: categoria.cor ?? "",
              parentId: categoria.parentId ?? ""
            }
          : { nome: "", tipo: "despesa", cor: "#6b7280", parentId: "" }
      );
    }
  }, [open, categoria, reset]);

  const tipoWatch = watch("tipo");
  const raizes = categorias.filter((c) => !c.parentId && c.tipo === tipoWatch && c.id !== categoria?.id);

  const onSubmit = async (values: FormData) => {
    const payload = {
      ...values,
      parentId: values.parentId || null
    };
    if (categoria) {
      await update.mutateAsync({ id: categoria.id, payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input {...register("nome")} placeholder="Ex: Fornecedores, Salários..." />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select
                value={watch("tipo")}
                onValueChange={(v) => setValue("tipo", v as "receita" | "despesa")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <Select value={watch("cor") ?? ""} onValueChange={(v) => setValue("cor", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar">
                    {watch("cor") && (
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: watch("cor") }}
                        />
                        {COR_OPTIONS.find((c) => c.value === watch("cor"))?.label ?? "Cor"}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.value }} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {raizes.length > 0 && (
            <div className="space-y-1">
              <Label>Categoria pai (opcional)</Label>
              <Select
                value={watch("parentId") ?? ""}
                onValueChange={(v) => setValue("parentId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem categoria pai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem categoria pai</SelectItem>
                  {raizes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

function CategoriaItem({
  cat,
  subcats,
  onEdit,
  onDelete
}: {
  cat: Categoria;
  subcats: Categoria[];
  onEdit: (c: Categoria) => void;
  onDelete: (c: Categoria) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div>
      <div className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50 group">
        <div className="flex items-center gap-2">
          {subcats.length > 0 ? (
            <button onClick={() => setExpanded((e) => !e)} className="text-muted-foreground">
              <ChevronRight
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <span className="w-4" />
          )}
          {cat.cor && (
            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.cor }} />
          )}
          <span className="text-sm font-medium">{cat.nome}</span>
          {subcats.length > 0 && (
            <span className="text-xs text-muted-foreground">({subcats.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(cat)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(cat)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {expanded && subcats.length > 0 && (
        <div className="ml-8 border-l pl-2">
          {subcats.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50 group"
            >
              <div className="flex items-center gap-2">
                {sub.cor && (
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: sub.cor }}
                  />
                )}
                <span className="text-sm">{sub.nome}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => onEdit(sub)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onDelete(sub)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriasPage() {
  const [tipoFilter, setTipoFilter] = React.useState<"despesa" | "receita" | undefined>(undefined);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editCat, setEditCat] = React.useState<Categoria | null>(null);

  const q = useCategorias(tipoFilter);
  const del = useDeleteCategoria();

  const cats = q.data ?? [];
  const raizes = cats.filter((c) => !c.parentId);
  const filtroCats = tipoFilter ? raizes.filter((c) => c.tipo === tipoFilter) : raizes;

  const openNew = () => {
    setEditCat(null);
    setModalOpen(true);
  };

  const openEdit = (c: Categoria) => {
    setEditCat(c);
    setModalOpen(true);
  };

  const handleDelete = async (c: Categoria) => {
    const subs = cats.filter((x) => x.parentId === c.id);
    const msg =
      subs.length > 0
        ? `Excluir "${c.nome}" e ${subs.length} subcategoria(s)?`
        : `Excluir "${c.nome}"?`;
    if (!confirm(msg)) return;
    await del.mutateAsync(c.id);
  };

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Organização hierárquica de receitas e despesas"
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Tabs
            value={tipoFilter ?? "todos"}
            onValueChange={(v) =>
              setTipoFilter(v === "todos" ? undefined : (v as "despesa" | "receita"))
            }
          >
            <TabsList>
              <TabsTrigger value="todos">
                Todas{" "}
                <Badge variant="secondary" className="ml-1">
                  {cats.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="despesa">
                Despesas{" "}
                <Badge variant="secondary" className="ml-1">
                  {cats.filter((c) => c.tipo === "despesa").length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="receita">
                Receitas{" "}
                <Badge variant="secondary" className="ml-1">
                  {cats.filter((c) => c.tipo === "receita").length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {q.isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : filtroCats.length === 0 ? (
          <EmptyState
            title="Nenhuma categoria"
            description="Crie categorias para organizar suas receitas e despesas."
            action={
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Nova categoria
              </Button>
            }
          />
        ) : (
          <div className="rounded-md border divide-y">
            {filtroCats.map((cat) => (
              <CategoriaItem
                key={cat.id}
                cat={cat}
                subcats={cats.filter((c) => c.parentId === cat.id)}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <CategoriaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        categoria={editCat}
        categorias={cats}
      />
    </>
  );
}
