"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateContaReceber } from "@/hooks/use-contas-receber";
import { useContatos } from "@/hooks/use-contatos";
import { useCategorias } from "@/hooks/use-categorias";
import { useAuthStore } from "@/store/auth";

const schema = z.object({
  contatoId: z.string().min(1),
  historico: z.string().min(2),
  categoriaId: z.string().min(1),
  dataEmissao: z.string().min(1),
  dataVencimento: z.string().min(1),
  valor: z.coerce.number().positive()
});
type FormData = z.infer<typeof schema>;

export function NovaContaReceberModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const empresaId = useAuthStore((s) => s.selectedCompany?.id);
  const create = useCreateContaReceber();
  const contatosQ = useContatos({ tipo: "cliente" });
  const categoriasQ = useCategorias("receita");

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { dataEmissao: new Date().toISOString().slice(0, 10) }
  });

  async function onSubmit(data: FormData) {
    await create.mutateAsync({ ...data, empresaId, situacao: "aberto" });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova conta a receber</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Cliente *</Label>
            <Select onValueChange={(v) => setValue("contatoId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {(contatosQ.data?.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.contatoId && <p className="text-xs text-destructive">{errors.contatoId.message}</p>}
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Histórico *</Label>
            <Input {...register("historico")} />
          </div>
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select onValueChange={(v) => setValue("categoriaId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {(categoriasQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor *</Label>
            <Input type="number" step="0.01" {...register("valor")} />
          </div>
          <div className="space-y-2">
            <Label>Emissão *</Label>
            <Input type="date" {...register("dataEmissao")} />
          </div>
          <div className="space-y-2">
            <Label>Vencimento *</Label>
            <Input type="date" {...register("dataVencimento")} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
