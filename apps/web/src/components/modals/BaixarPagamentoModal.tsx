"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
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
import { useBaixarContaPagar } from "@/hooks/use-contas-pagar";
import { useFormasPagamento } from "@/hooks/use-formas-pagamento";
import type { ContaPagar } from "@/types";
import { formatCurrency } from "@/lib/format";

const schema = z.object({
  dataPagamento: z.string().min(1),
  valorPago: z.coerce.number().positive(),
  formaPagamentoId: z.string().optional(),
  observacoes: z.string().optional()
});

type FormData = z.infer<typeof schema>;

export function BaixarPagamentoModal({
  open,
  onOpenChange,
  conta
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conta: ContaPagar | null;
}) {
  const baixar = useBaixarContaPagar();
  const formasQ = useFormasPagamento();

  const {
    register,
    handleSubmit,
    setValue,
    reset
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      dataPagamento: new Date().toISOString().slice(0, 10),
      valorPago: conta?.saldo ?? conta?.valor ?? 0
    }
  });

  React.useEffect(() => {
    if (conta) {
      reset({
        dataPagamento: new Date().toISOString().slice(0, 10),
        valorPago: conta.saldo ?? conta.valor
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
          <DialogTitle>Baixar pagamento</DialogTitle>
          <DialogDescription>
            {conta.contatoNome ?? conta.historico} — {formatCurrency(conta.valor)} — Venc:{" "}
            {new Date(conta.dataVencimento).toLocaleDateString("pt-BR")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Data do pagamento *</Label>
            <Input type="date" {...register("dataPagamento")} />
          </div>
          <div className="space-y-2">
            <Label>Valor pago *</Label>
            <Input type="number" step="0.01" {...register("valorPago")} />
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
            <Label>Observações</Label>
            <Input {...register("observacoes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="success" disabled={baixar.isPending}>
              {baixar.isPending ? "Baixando..." : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
