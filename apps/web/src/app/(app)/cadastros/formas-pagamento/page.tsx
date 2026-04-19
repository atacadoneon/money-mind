"use client";

import * as React from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  useFormasPagamento,
  useCreateFormaPagamento,
  useUpdateFormaPagamento,
  useDeleteFormaPagamento
} from "@/hooks/use-formas-pagamento";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { FormaPagamento } from "@/types";

const TIPO_LABELS: Record<FormaPagamento["tipo"], string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  boleto: "Boleto",
  pix: "PIX",
  transferencia: "TED / Transferência",
  outro: "Outro"
};

const TIPO_VARIANTS: Record<
  FormaPagamento["tipo"],
  "default" | "secondary" | "outline" | "success"
> = {
  pix: "success",
  boleto: "default",
  transferencia: "default",
  cartao: "secondary",
  dinheiro: "outline",
  outro: "outline"
};

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipo: z.enum(["dinheiro", "cartao", "boleto", "pix", "transferencia", "outro"])
});

type FormData = z.infer<typeof schema>;

function FormaPagamentoModal({
  open,
  onOpenChange,
  forma
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  forma?: FormaPagamento | null;
}) {
  const create = useCreateFormaPagamento();
  const update = useUpdateFormaPagamento();
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
    defaultValues: { tipo: "pix" }
  });

  React.useEffect(() => {
    if (open) {
      reset(
        forma
          ? { nome: forma.nome, tipo: forma.tipo }
          : { nome: "", tipo: "pix" }
      );
    }
  }, [open, forma, reset]);

  const onSubmit = async (values: FormData) => {
    if (forma) {
      await update.mutateAsync({ id: forma.id, payload: values });
    } else {
      await create.mutateAsync(values);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{forma ? "Editar forma de pagamento" : "Nova forma de pagamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input {...register("nome")} placeholder="Ex: PIX Sicoob, Cartão Nubank..." />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Tipo *</Label>
            <Select
              value={watch("tipo")}
              onValueChange={(v) => setValue("tipo", v as FormaPagamento["tipo"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

export default function FormasPagamentoPage() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editForma, setEditForma] = React.useState<FormaPagamento | null>(null);

  const q = useFormasPagamento();
  const del = useDeleteFormaPagamento();

  const formas = q.data ?? [];

  const openNew = () => {
    setEditForma(null);
    setModalOpen(true);
  };

  const openEdit = (f: FormaPagamento) => {
    setEditForma(f);
    setModalOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Formas de pagamento"
        description="Gerencie os meios de pagamento disponíveis"
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nova forma
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {q.isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : formas.length === 0 ? (
          <EmptyState
            title="Nenhuma forma de pagamento"
            description="Cadastre formas de pagamento para usar nos lançamentos."
            action={
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Nova forma
              </Button>
            }
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>
                      <Badge variant={TIPO_VARIANTS[f.tipo]}>{TIPO_LABELS[f.tipo]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(f)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Excluir "${f.nome}"?`)) del.mutate(f.id);
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

      <FormaPagamentoModal open={modalOpen} onOpenChange={setModalOpen} forma={editForma} />
    </>
  );
}
