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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBaixarContaReceber } from "@/hooks/use-contas-receber";
import { useFormasPagamento } from "@/hooks/use-formas-pagamento";
import type { ContaReceber } from "@/types";
import { formatCurrency } from "@/lib/format";

const schema = z.object({
  dataRecebimento: z.string().min(1),
  valorRecebido: z.coerce.number().positive(),
  formaPagamentoId: z.string().optional()
});
type FormData = z.infer<typeof schema>;

export function BaixarRecebimentoModal({
  open,
  onOpenChange,
  conta
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conta: ContaReceber | null;
}) {
  const baixar = useBaixarContaReceber();
  const formasQ = useFormasPagamento();
  const { register, handleSubmit, setValue, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      dataRecebimento: new Date().toISOString().slice(0, 10),
      valorRecebido: conta?.saldo ?? conta?.valor ?? 0
    }
  });

  React.useEffect(() => {
    if (conta) {
      reset({
        dataRecebimento: new Date().toISOString().slice(0, 10),
        valorRecebido: conta.saldo ?? conta.valor
      });
    }
  }, [conta, reset]);

  async function onSubmit(data: FormData) {
    if (!conta) return;
    await baixar.mutateAsync({ id: conta.id, ...data });
    onOpenChange(false);
  }

  if (!conta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baixar recebimento</DialogTitle>
          <DialogDescription>
            {conta.contatoNome ?? conta.historico} — {formatCurrency(conta.valor)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Data *</Label>
            <Input type="date" {...register("dataRecebimento")} />
          </div>
          <div className="space-y-2">
            <Label>Valor recebido *</Label>
            <Input type="number" step="0.01" {...register("valorRecebido")} />
          </div>
          <div className="space-y-2">
            <Label>Forma</Label>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="success" disabled={baixar.isPending}>
              {baixar.isPending ? "Processando..." : "Confirmar recebimento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
