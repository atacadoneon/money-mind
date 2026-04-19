"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  name: z.string().min(3, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  cpf: z.string().optional(),
  tipo: z.enum(["acesso", "correcao", "anonimizacao", "portabilidade", "eliminacao", "revogacao_consentimento"], {
    required_error: "Selecione o tipo de solicitação",
  }),
  descricao: z.string().min(20, "Descreva sua solicitação (mínimo 20 caracteres)"),
});

type DpoForm = z.infer<typeof schema>;

const TIPO_LABELS = {
  acesso: "Acesso aos meus dados",
  correcao: "Correção de dados incorretos",
  anonimizacao: "Anonimização de dados",
  portabilidade: "Portabilidade dos meus dados",
  eliminacao: "Eliminação/exclusão de dados",
  revogacao_consentimento: "Revogação de consentimento",
};

export default function DpoPage() {
  const [submitted, setSubmitted] = React.useState(false);
  const [protocol, setProtocol] = React.useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DpoForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: DpoForm) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api/v1";
      const { data } = await axios.post(`${apiUrl}/lgpd/dpo-request`, values);
      setProtocol(data.protocolNumber ?? "DPO-" + Date.now());
      setSubmitted(true);
      toast.success("Solicitação enviada ao DPO com sucesso.");
    } catch {
      toast.error("Erro ao enviar solicitação. Tente novamente ou contate dpo@moneymind.com.br");
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Solicitação recebida!</h1>
        <p className="text-muted-foreground mb-4">
          Seu protocolo é: <strong className="font-mono text-foreground">{protocol}</strong>
        </p>
        <p className="text-sm text-muted-foreground">
          Responderemos em até <strong>15 dias úteis</strong> no e-mail informado, conforme exigido pela LGPD Art. 18.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Contato com o DPO</h1>
        <p className="text-muted-foreground">
          Exercite seus direitos previstos na LGPD (Art. 18). Preencha o formulário abaixo
          e responderemos em até 15 dias úteis.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">DPO</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>dpo@moneymind.com.br</p>
            <p>Resposta: até 15 dias úteis</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ANPD</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>www.gov.br/anpd</p>
            <p>Recurso em caso de insatisfação</p>
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input {...register("name")} placeholder="Seu nome" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input type="email" {...register("email")} placeholder="seu@email.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>CPF (opcional, para validação de identidade)</Label>
            <Input {...register("cpf")} placeholder="000.000.000-00" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de solicitação *</Label>
            <Select
              value={watch("tipo")}
              onValueChange={(v) => setValue("tipo", v as DpoForm["tipo"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tipo && <p className="text-xs text-destructive">{errors.tipo.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Descrição detalhada *</Label>
          <Textarea
            {...register("descricao")}
            placeholder="Descreva sua solicitação em detalhes..."
            rows={5}
          />
          {errors.descricao && <p className="text-xs text-destructive">{errors.descricao.message}</p>}
        </div>

        <p className="text-xs text-muted-foreground">
          Os dados informados neste formulário serão usados exclusivamente para atender sua solicitação,
          conforme a LGPD. Ao enviar, você concorda com isso.
        </p>

        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Enviar solicitação ao DPO
        </Button>
      </form>
    </div>
  );
}
