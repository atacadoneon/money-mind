"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useContato, useUpdateContato } from "@/hooks/use-contatos";
import { useContasPagar } from "@/hooks/use-contas-pagar";
import { useContasReceber } from "@/hooks/use-contas-receber";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatCurrency, formatDate, formatCpfCnpj } from "@/lib/format";
import { StatusBadge } from "@/components/tables/StatusBadge";
import type { Contato } from "@/types";

const schema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  tipos: z.array(z.string()).min(1),
  cpfCnpj: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
  observacoes: z.string().optional()
});

type FormData = z.infer<typeof schema>;

function tipoFromArray(tipos?: string[]): string {
  if (!tipos || tipos.length === 0) return "ambos";
  if (tipos.includes("cliente") && tipos.includes("fornecedor")) return "ambos";
  return tipos[0] ?? "ambos";
}

function tipoToArray(tipo: string): string[] {
  if (tipo === "ambos") return ["cliente", "fornecedor"];
  return [tipo];
}

export default function ContactEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const contatoQ = useContato(params.id);
  const update = useUpdateContato();

  const cpQ = useContasPagar({ contatoId: params.id, pageSize: 10 });
  const crQ = useContasReceber({ contatoId: params.id, pageSize: 10 });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipos: ["cliente", "fornecedor"] }
  });

  React.useEffect(() => {
    if (contatoQ.data) {
      const c = contatoQ.data as Contato & Record<string, unknown>;
      reset({
        nome: c.nome,
        tipos: c.tipos ?? tipoToArray("ambos"),
        cpfCnpj: c.cpfCnpj ?? "",
        email: c.email ?? "",
        telefone: c.telefone ?? "",
        cep: (c.cep as string) ?? "",
        logradouro: (c.logradouro as string) ?? "",
        numero: (c.numero as string) ?? "",
        complemento: (c.complemento as string) ?? "",
        bairro: (c.bairro as string) ?? "",
        cidade: (c.cidade as string) ?? "",
        uf: (c.uf as string) ?? "",
        observacoes: (c.observacoes as string) ?? ""
      });
    }
  }, [contatoQ.data, reset]);

  const onSubmit = async (values: FormData) => {
    await update.mutateAsync({ id: params.id, payload: values });
  };

  if (contatoQ.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (contatoQ.isError || !contatoQ.data) {
    return (
      <div className="p-6">
        <p className="text-destructive">Contato não encontrado.</p>
        <Button variant="link" onClick={() => router.back()}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={contatoQ.data.nome}
        description={formatCpfCnpj(contatoQ.data.cpfCnpj)}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit(onSubmit)}
              disabled={!isDirty || update.isPending}
            >
              <Save className="h-4 w-4" /> {update.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dados cadastrais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <Label>Nome / Razão social *</Label>
                    <Input {...register("nome")} />
                    {errors.nome && (
                      <p className="text-xs text-destructive">{errors.nome.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Papel</Label>
                    <Select
                      value={tipoFromArray(watch("tipos"))}
                      onValueChange={(v) => setValue("tipos", tipoToArray(v), { shouldDirty: true })}
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
                    <Label>CPF / CNPJ</Label>
                    <Input {...register("cpfCnpj")} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-1">
                    <Label>E-mail</Label>
                    <Input type="email" {...register("email")} />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Telefone</Label>
                    <Input {...register("telefone")} placeholder="(11) 9 0000-0000" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Endereço</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label>CEP</Label>
                    <Input {...register("cep")} placeholder="00000-000" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Logradouro</Label>
                    <Input {...register("logradouro")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Número</Label>
                    <Input {...register("numero")} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Complemento</Label>
                    <Input {...register("complemento")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Bairro</Label>
                    <Input {...register("bairro")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Cidade</Label>
                    <Input {...register("cidade")} />
                  </div>
                  <div className="space-y-1">
                    <Label>UF</Label>
                    <Input {...register("uf")} maxLength={2} className="uppercase" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  {...register("observacoes")}
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Observações internas sobre este contato..."
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico — Contas a pagar</CardTitle>
              </CardHeader>
              <CardContent>
                {cpQ.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                  </div>
                ) : (cpQ.data?.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem lançamentos</p>
                ) : (
                  <ul className="space-y-2">
                    {(cpQ.data?.data ?? []).map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{c.historico}</p>
                          <p className="text-muted-foreground text-xs">
                            {formatDate(c.dataVencimento)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-2">
                          <span className="font-semibold">{formatCurrency(c.valor)}</span>
                          <StatusBadge status={c.situacao} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico — Contas a receber</CardTitle>
              </CardHeader>
              <CardContent>
                {crQ.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                  </div>
                ) : (crQ.data?.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem lançamentos</p>
                ) : (
                  <ul className="space-y-2">
                    {(crQ.data?.data ?? []).map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{c.historico}</p>
                          <p className="text-muted-foreground text-xs">
                            {formatDate(c.dataVencimento)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-2">
                          <span className="font-semibold">{formatCurrency(c.valor)}</span>
                          <StatusBadge status={c.situacao} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
