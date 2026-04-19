"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useCreateContaPagar } from "@/hooks/use-contas-pagar";
import { useContatos } from "@/hooks/use-contatos";
import { useCategorias } from "@/hooks/use-categorias";
import { useFormasPagamento } from "@/hooks/use-formas-pagamento";
import { useAuthStore } from "@/store/auth";

const schema = z.object({
  contatoId: z.string().min(1, "Obrigatório"),
  historico: z.string().min(2),
  categoriaId: z.string().min(1),
  dataEmissao: z.string().min(1),
  dataVencimento: z.string().min(1),
  valor: z.coerce.number().positive(),
  formaPagamentoId: z.string().optional(),
  numeroDocumento: z.string().optional(),
  observacoes: z.string().optional()
});

type FormData = z.infer<typeof schema>;

export function NovaContaPagarModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const empresaId = useAuthStore((s) => s.selectedCompany?.id);
  const create = useCreateContaPagar();
  const contatosQ = useContatos({ tipo: "fornecedor" });
  const categoriasQ = useCategorias("despesa");
  const formasQ = useFormasPagamento();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      dataEmissao: new Date().toISOString().slice(0, 10)
    }
  });

  async function onSubmit(data: FormData) {
    await create.mutateAsync({ ...data, empresaId, situacao: "aberto" });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova conta a pagar</DialogTitle>
          <DialogDescription>Cadastre um título no contas a pagar</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Fornecedor *</Label>
            <Select onValueChange={(v) => setValue("contatoId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {(contatosQ.data?.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.contatoId && (
              <p className="text-xs text-destructive">{errors.contatoId.message}</p>
            )}
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Histórico *</Label>
            <Input {...register("historico")} placeholder="Descrição da conta" />
            {errors.historico && (
              <p className="text-xs text-destructive">{errors.historico.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select onValueChange={(v) => setValue("categoriaId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {(categoriasQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select onValueChange={(v) => setValue("formaPagamentoId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {(formasQ.data ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data de emissão *</Label>
            <Input type="date" {...register("dataEmissao")} />
          </div>
          <div className="space-y-2">
            <Label>Data de vencimento *</Label>
            <Input type="date" {...register("dataVencimento")} />
            {errors.dataVencimento && (
              <p className="text-xs text-destructive">{errors.dataVencimento.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Valor *</Label>
            <Input type="number" step="0.01" {...register("valor")} placeholder="0,00" />
            {errors.valor && <p className="text-xs text-destructive">{errors.valor.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Nº documento</Label>
            <Input {...register("numeroDocumento")} placeholder="NF, boleto, etc." />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Observações</Label>
            <Input {...register("observacoes")} />
          </div>

          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
