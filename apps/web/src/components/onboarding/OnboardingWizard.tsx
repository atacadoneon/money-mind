"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OnboardingProgress } from "./OnboardingProgress";
import { ConnectionTester } from "./ConnectionTester";
import { useOnboardingStore, ONBOARDING_STEPS } from "@/store/onboarding";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api/client";
import {
  CheckCircle2,
  Building2,
  Database,
  CreditCard,
  Download,
  Tag,
  MapPin,
  ArrowRight,
  SkipForward,
  Loader2
} from "lucide-react";

/* ─── Step: Welcome ─── */
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-4xl font-bold shadow-lg">
        M
      </div>
      <div>
        <h2 className="text-2xl font-bold">Bem-vindo ao Money Mind</h2>
        <p className="mt-2 text-muted-foreground max-w-md">
          Vamos configurar sua conta em 5 minutos. Configure sua empresa, integrações e importe
          seus dados financeiros para começar.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm text-left">
        {[
          { icon: Building2, text: "Dados da empresa" },
          { icon: Database, text: "Integração Tiny ERP" },
          { icon: CreditCard, text: "Conta digital" },
          { icon: Download, text: "Importação inicial" }
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <Icon className="h-4 w-4 text-primary shrink-0" />
            {text}
          </div>
        ))}
      </div>
      <Button size="lg" onClick={onNext} className="mt-2">
        Vamos lá <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

/* ─── Step: Company ─── */
const companySchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cnpj: z.string().optional(),
  segmento: z.string().optional()
});
type CompanyForm = z.infer<typeof companySchema>;

const SEGMENTOS = [
  "Varejo",
  "Serviços",
  "Indústria",
  "Tecnologia",
  "Agronegócio",
  "Saúde",
  "Educação",
  "Outro"
];

function StepCompany({ onNext }: { onNext: () => void }) {
  const { companyData, setCompanyData } = useOnboardingStore();
  const { selectedCompany } = useAuthStore();
  const [loading, setLoading] = React.useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      nome: companyData?.nome ?? selectedCompany?.nome ?? "",
      cnpj: companyData?.cnpj ?? selectedCompany?.cnpj ?? "",
      segmento: companyData?.segmento ?? ""
    }
  });

  const onSubmit = async (values: CompanyForm) => {
    setLoading(true);
    try {
      if (selectedCompany?.id) {
        await api.patch(`/companies/${selectedCompany.id}`, values);
      }
      setCompanyData({ nome: values.nome, cnpj: values.cnpj ?? "", segmento: values.segmento ?? "" });
      onNext();
    } catch {
      toast.error("Erro ao salvar dados da empresa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Dados da empresa</h2>
        <p className="text-sm text-muted-foreground">Preencha as informações básicas da sua empresa</p>
      </div>

      <div className="space-y-1">
        <Label>Nome da empresa *</Label>
        <Input {...register("nome")} placeholder="Ex: Atacado Neon LTDA" />
        {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>CNPJ</Label>
        <Input {...register("cnpj")} placeholder="00.000.000/0001-00" />
      </div>

      <div className="space-y-1">
        <Label>Segmento</Label>
        <Select value={watch("segmento")} onValueChange={(v) => setValue("segmento", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o segmento..." />
          </SelectTrigger>
          <SelectContent>
            {SEGMENTOS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Continuar <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

/* ─── Step: Tiny ERP ─── */
const tinySchema = z.object({
  clientId: z.string().min(1, "Client ID obrigatório"),
  clientSecret: z.string().min(1, "Client Secret obrigatório"),
  v3Token: z.string().optional()
});
type TinyForm = z.infer<typeof tinySchema>;

function StepTiny({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { tinyData, setTinyData } = useOnboardingStore();
  const { selectedCompany } = useAuthStore();
  const [useTiny, setUseTiny] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [connected, setConnected] = React.useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<TinyForm>({
    resolver: zodResolver(tinySchema),
    defaultValues: {
      clientId: tinyData?.clientId ?? "",
      clientSecret: tinyData?.clientSecret ?? "",
      v3Token: tinyData?.v3Token ?? ""
    }
  });

  const onSubmit = async (values: TinyForm) => {
    setLoading(true);
    try {
      if (selectedCompany?.id) {
        await api.patch(`/companies/${selectedCompany.id}`, {
          tinyClientId: values.clientId,
          tinyClientSecret: values.clientSecret,
          tinyV3Token: values.v3Token
        });
      }
      setTinyData({ clientId: values.clientId, clientSecret: values.clientSecret, v3Token: values.v3Token ?? "" });
      onNext();
    } catch {
      toast.error("Erro ao salvar credenciais Tiny");
    } finally {
      setLoading(false);
    }
  };

  if (useTiny === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Integrar Tiny ERP</h2>
          <p className="text-sm text-muted-foreground">
            Sincronize automaticamente contas a pagar, receber, contatos e categorias com o Tiny ERP / Olist
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => setUseTiny(true)}
          >
            <CardContent className="flex flex-col items-center gap-3 p-6">
              <Database className="h-8 w-8 text-primary" />
              <p className="font-medium text-center">Sim, tenho Tiny ERP</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-muted-foreground transition-colors"
            onClick={() => { setUseTiny(false); onSkip(); }}
          >
            <CardContent className="flex flex-col items-center gap-3 p-6">
              <SkipForward className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium text-center text-muted-foreground">Pular por agora</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Credenciais Tiny ERP</h2>
        <p className="text-sm text-muted-foreground">Encontre em Tiny ERP → Configurações → API</p>
      </div>

      <div className="space-y-1">
        <Label>Client ID (V2) *</Label>
        <Input {...register("clientId")} placeholder="client_id..." />
        {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>Client Secret (V2) *</Label>
        <Input type="password" {...register("clientSecret")} placeholder="client_secret..." />
        {errors.clientSecret && <p className="text-xs text-destructive">{errors.clientSecret.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>Token V3 (opcional)</Label>
        <Input type="password" {...register("v3Token")} placeholder="token_v3..." />
      </div>

      <ConnectionTester
        companyId={selectedCompany?.id}
        type="tiny"
        onSuccess={() => setConnected(true)}
      />

      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={onSkip}>
          <SkipForward className="h-4 w-4 mr-1" /> Pular
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {connected ? <CheckCircle2 className="h-4 w-4 mr-2 text-success" /> : null}
          Continuar <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

/* ─── Step: Conta Simples ─── */
const contaSimplesSchema = z.object({
  apiKey: z.string().min(1, "API Key obrigatória"),
  apiSecret: z.string().min(1, "API Secret obrigatório")
});
type ContaSimplesForm = z.infer<typeof contaSimplesSchema>;

function StepContaSimples({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { contaSimplesData, setContaSimplesData } = useOnboardingStore();
  const { selectedCompany } = useAuthStore();
  const [useCS, setUseCS] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ContaSimplesForm>({
    resolver: zodResolver(contaSimplesSchema),
    defaultValues: {
      apiKey: contaSimplesData?.apiKey ?? "",
      apiSecret: contaSimplesData?.apiSecret ?? ""
    }
  });

  const onSubmit = async (values: ContaSimplesForm) => {
    setLoading(true);
    try {
      if (selectedCompany?.id) {
        await api.patch(`/companies/${selectedCompany.id}`, {
          contaSimplesApiKey: values.apiKey,
          contaSimplesApiSecret: values.apiSecret
        });
      }
      setContaSimplesData({ apiKey: values.apiKey, apiSecret: values.apiSecret });
      onNext();
    } catch {
      toast.error("Erro ao salvar credenciais Conta Simples");
    } finally {
      setLoading(false);
    }
  };

  if (useCS === null) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Integrar Conta Simples</h2>
          <p className="text-sm text-muted-foreground">
            Conecte sua conta bancária PJ para sincronizar extratos automaticamente
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => setUseCS(true)}
          >
            <CardContent className="flex flex-col items-center gap-3 p-6">
              <CreditCard className="h-8 w-8 text-primary" />
              <p className="font-medium text-center">Sim, tenho Conta Simples</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-muted-foreground transition-colors"
            onClick={() => { setUseCS(false); onSkip(); }}
          >
            <CardContent className="flex flex-col items-center gap-3 p-6">
              <SkipForward className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium text-center text-muted-foreground">Pular por agora</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Credenciais Conta Simples</h2>
      </div>

      <div className="space-y-1">
        <Label>API Key *</Label>
        <Input {...register("apiKey")} placeholder="cs_api_key..." />
        {errors.apiKey && <p className="text-xs text-destructive">{errors.apiKey.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>API Secret *</Label>
        <Input type="password" {...register("apiSecret")} placeholder="cs_api_secret..." />
        {errors.apiSecret && <p className="text-xs text-destructive">{errors.apiSecret.message}</p>}
      </div>

      <ConnectionTester
        companyId={selectedCompany?.id}
        type="conta-simples"
      />

      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={onSkip}>
          <SkipForward className="h-4 w-4 mr-1" /> Pular
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Continuar <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

/* ─── Step: Import ─── */
function StepImport({ onNext }: { onNext: () => void }) {
  const { importOptions, setImportOptions, setSyncJobId, syncJobId } = useOnboardingStore();
  const { selectedCompany } = useAuthStore();
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const startImport = async () => {
    if (!selectedCompany?.id) return;
    setLoading(true);
    setProgress(5);
    try {
      const { data } = await api.post<{ jobId: string }>(
        `/mcps/tiny/sync/${selectedCompany.id}`,
        importOptions
      );
      setSyncJobId(data.jobId);

      let p = 10;
      pollRef.current = setInterval(async () => {
        try {
          const res = await api.get<{ status: string; progress?: number }>(
            `/mcps/tiny/sync-status/${data.jobId}`
          );
          if (res.data.progress) setProgress(res.data.progress);
          else {
            p = Math.min(p + 10, 90);
            setProgress(p);
          }
          if (res.data.status === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            setProgress(100);
            setDone(true);
            setLoading(false);
          } else if (res.data.status === "error") {
            if (pollRef.current) clearInterval(pollRef.current);
            toast.error("Erro na sincronização");
            setLoading(false);
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          setLoading(false);
        }
      }, 2000);
    } catch {
      toast.error("Erro ao iniciar importação");
      setLoading(false);
    }
  };

  React.useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const OPTIONS = [
    { key: "contatos" as const, label: "Contatos (clientes / fornecedores)" },
    { key: "cp" as const, label: "Contas a pagar — últimos 90 dias" },
    { key: "cr" as const, label: "Contas a receber — últimos 90 dias" },
    { key: "categorias" as const, label: "Categorias financeiras" }
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Importar dados iniciais</h2>
        <p className="text-sm text-muted-foreground">
          Selecione o que deseja importar do Tiny ERP para começar
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox
              id={key}
              checked={importOptions[key]}
              onCheckedChange={(v) => setImportOptions({ [key]: !!v })}
              disabled={loading}
            />
            <label htmlFor={key} className="text-sm cursor-pointer">
              {label}
            </label>
          </div>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Importando dados... {progress}%
          </p>
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          Importação concluída com sucesso!
        </div>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={onNext} disabled={loading}>
          <SkipForward className="h-4 w-4 mr-1" /> Pular
        </Button>
        {!done ? (
          <Button onClick={startImport} disabled={loading || !selectedCompany?.id}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            {syncJobId ? "Sincronizando..." : "Importar agora"}
          </Button>
        ) : (
          <Button onClick={onNext}>
            Continuar <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Step: Marker ─── */
function StepMarker({ onNext }: { onNext: () => void }) {
  const { selectedCompany } = useAuthStore();
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const createMarker = async () => {
    setLoading(true);
    try {
      await api.post("/marcadores", {
        descricao: "CLAUDE",
        cor: "#3b82f6",
        empresaId: selectedCompany?.id
      });
      setDone(true);
    } catch {
      // Marcador pode já existir
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    createMarker();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div>
        <h2 className="text-xl font-bold">Criando marcador CLAUDE</h2>
        <p className="text-sm text-muted-foreground">
          Um marcador especial para identificar registros processados pela IA
        </p>
      </div>

      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary">
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : (
          <Tag className="h-8 w-8 text-primary" />
        )}
      </div>

      {done && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          Marcador CLAUDE criado
        </div>
      )}

      <Button onClick={onNext} disabled={loading}>
        Continuar <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

/* ─── Step: Tour ─── */
function StepTour({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <MapPin className="h-12 w-12 text-primary" />
      <div>
        <h2 className="text-xl font-bold">Tour pelo sistema</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Veja como navegar pelo sistema e aproveitar todos os recursos
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 text-left w-full max-w-sm">
        {[
          { icon: "🏠", label: "Início", desc: "Dashboard com KPIs consolidados" },
          { icon: "📤", label: "Contas a Pagar", desc: "Gerencie seus pagamentos" },
          { icon: "📥", label: "Contas a Receber", desc: "Controle cobranças" },
          { icon: "🔗", label: "Conciliação IA", desc: "Match automático com Claude" }
        ].map(({ icon, label, desc }) => (
          <div key={label} className="flex items-start gap-3 rounded-lg border p-3">
            <span className="text-xl">{icon}</span>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <Button onClick={onNext} size="lg">
        Ir para o sistema <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

/* ─── Main Wizard ─── */
export function OnboardingWizard() {
  const router = useRouter();
  const {
    currentStep,
    completedSteps,
    setStep,
    nextStep,
    markCompleted,
    reset
  } = useOnboardingStore();
  const { selectedCompany } = useAuthStore();
  const [finishing, setFinishing] = React.useState(false);

  const goNext = () => {
    markCompleted(currentStep);
    nextStep();
  };

  const skipTo = (step: typeof currentStep) => {
    markCompleted(currentStep);
    setStep(step);
  };

  const finish = async () => {
    setFinishing(true);
    try {
      await api.patch(`/organizations/${selectedCompany?.id ?? "current"}`, {
        settings: { onboarded: true }
      });
    } catch {
      // ignore — still redirect
    } finally {
      reset();
      router.push("/inicio");
    }
  };

  React.useEffect(() => {
    if (currentStep === "done") {
      finish();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const stepIndex = ONBOARDING_STEPS.indexOf(currentStep);
  const totalSteps = ONBOARDING_STEPS.length - 1; // exclude "done"
  const progressPct = Math.round((stepIndex / totalSteps) * 100);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl">
        <div className="mb-6 space-y-4">
          <OnboardingProgress
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
          <Progress value={progressPct} className="h-1" />
        </div>

        <Card>
          <CardContent className="p-6 min-h-[380px]">
            {finishing ? (
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Finalizando configuração...</p>
              </div>
            ) : currentStep === "welcome" ? (
              <StepWelcome onNext={goNext} />
            ) : currentStep === "company" ? (
              <StepCompany onNext={goNext} />
            ) : currentStep === "tiny" ? (
              <StepTiny onNext={goNext} onSkip={() => skipTo("conta-simples")} />
            ) : currentStep === "conta-simples" ? (
              <StepContaSimples onNext={goNext} onSkip={() => skipTo("import")} />
            ) : currentStep === "import" ? (
              <StepImport onNext={goNext} />
            ) : currentStep === "marker" ? (
              <StepMarker onNext={goNext} />
            ) : currentStep === "tour" ? (
              <StepTour onNext={() => setStep("done")} />
            ) : null}
          </CardContent>
        </Card>

        {currentStep !== "welcome" && currentStep !== "done" && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Etapa {stepIndex} de {totalSteps}
          </p>
        )}
      </div>
    </div>
  );
}
