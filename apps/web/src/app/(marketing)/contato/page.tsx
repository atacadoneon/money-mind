"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(3, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  empresa: z.string().optional(),
  tamanho: z.string().optional(),
  mensagem: z.string().min(20, "Mensagem muito curta (mínimo 20 caracteres)"),
});

type ContactForm = z.infer<typeof schema>;

export default function ContatoPage() {
  const [submitted, setSubmitted] = React.useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<ContactForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: ContactForm) => {
    // In production, send to backend
    await new Promise((r) => setTimeout(r, 1000));
    console.log("Contact form:", values);
    toast.success("Mensagem enviada! Entraremos em contato em breve.");
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="py-20">
        <div className="max-w-lg mx-auto px-4 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Mensagem enviada!</h1>
          <p className="text-muted-foreground">Nossa equipe entrará em contato em até 1 dia útil.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-20">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-3">Fale com nossa equipe</h1>
          <p className="text-muted-foreground">
            Interessado no plano Enterprise ou tem dúvidas? Entre em contato.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
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
              <Label>Empresa</Label>
              <Input {...register("empresa")} placeholder="Nome da empresa" />
            </div>
            <div className="space-y-1.5">
              <Label>Tamanho (nº de empresas gerenciadas)</Label>
              <Select value={watch("tamanho")} onValueChange={(v) => setValue("tamanho", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-5">1 a 5 empresas</SelectItem>
                  <SelectItem value="6-20">6 a 20 empresas</SelectItem>
                  <SelectItem value="21-50">21 a 50 empresas</SelectItem>
                  <SelectItem value="50+">Mais de 50 empresas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem *</Label>
            <Textarea {...register("mensagem")} placeholder="Descreva sua necessidade..." rows={5} />
            {errors.mensagem && <p className="text-xs text-destructive">{errors.mensagem.message}</p>}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar mensagem
          </Button>
        </form>
      </div>
    </div>
  );
}
