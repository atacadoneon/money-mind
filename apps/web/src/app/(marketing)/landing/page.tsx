import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Zap,
  Building2,
  BarChart3,
  Bell,
  Plug,
  ArrowRight,
  Shield,
  TrendingUp,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Money Mind BPO — BPO Financeiro com IA para empresas brasileiras",
  description:
    "Plataforma BPO Financeiro que concilia extratos automaticamente, gestiona CP/CR, integra com Tiny ERP e bancos, e gera relatórios financeiros inteligentes.",
  openGraph: {
    title: "Money Mind BPO — Conciliação financeira com IA",
    description: "Automatize sua gestão financeira. Conciliação automática, multi-empresa, integração bancária.",
    type: "website",
  },
};

const FEATURES = [
  { icon: Zap, title: "Conciliação automática com IA", description: "Nossa IA reconcilia extratos bancários com transações em segundos. Reduza horas de trabalho manual a minutos." },
  { icon: Building2, title: "Multi-empresa", description: "Gerencie múltiplas empresas em uma única plataforma. Dashboard unificado, relatórios consolidados." },
  { icon: Plug, title: "Integração Tiny ERP / Olist", description: "Sincronização automática bidirecional de pedidos, NF-e, clientes e financeiro com o Tiny ERP." },
  { icon: BarChart3, title: "Relatórios inteligentes", description: "DRE, Fluxo de Caixa projetado, inadimplência e mais. Dados em tempo real, exportáveis em PDF/Excel." },
  { icon: Bell, title: "Régua de cobrança automatizada", description: "Cobranças por WhatsApp, e-mail e SMS no momento certo. Reduza a inadimplência sem esforço." },
  { icon: Shield, title: "Segurança bancária", description: "RLS, criptografia AES-256, TLS 1.3, MFA e auditoria completa. Seus dados financeiros protegidos." },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Conecte sua empresa", description: "Configure suas empresas, bancos e integrações em minutos. Importe extratos OFX ou conecte via Open Finance." },
  { step: "2", title: "A IA trabalha por você", description: "Nosso motor de IA reconcilia automaticamente extratos com contas a pagar/receber. Sugestões inteligentes para o que não é automático." },
  { step: "3", title: "Tome decisões com dados", description: "Relatórios em tempo real, alertas de vencimento e projeções de fluxo de caixa para você focar no crescimento." },
];

const INTEGRATIONS = [
  { name: "Tiny ERP / Olist" }, { name: "Sicoob" }, { name: "Itaú" }, { name: "Pagar.me" }, { name: "Conta Simples" }, { name: "WhatsApp" },
];

const FAQ = [
  { q: "Preciso saber programar para usar?", a: "Não. O Money Mind é uma plataforma web fácil de usar, sem necessidade de conhecimento técnico." },
  { q: "Quantas empresas posso gerenciar?", a: "Depende do plano. O Starter permite até 3, o Pro até 10, e Business/Enterprise são ilimitados." },
  { q: "Como funciona o trial gratuito?", a: "14 dias grátis com acesso a todas as funcionalidades do plano Starter. Sem cartão de crédito." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim. Cancele pelo painel com 1 clique. Sem fidelidade, sem multa." },
  { q: "Os dados são seguros?", a: "Sim. Usamos criptografia AES-256, TLS 1.3, Row Level Security e backups diários. Conformidade com LGPD." },
  { q: "Integra com qual banco?", a: "Sicoob, Itaú, e outros via OFX. Integração com Conta Simples para extrato automático." },
  { q: "Como funciona a régua de cobrança?", a: "Configure horário, canal (WhatsApp/e-mail/SMS) e gatilhos de vencimento. A plataforma envia automaticamente." },
  { q: "Posso usar para BPO (múltiplos clientes)?", a: "Sim! O Money Mind foi desenhado para escritórios de contabilidade e BPOs que gerenciam múltiplas empresas clientes." },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-6 text-xs font-medium">BPO Financeiro com IA • 14 dias grátis</Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto">
            BPO Financeiro com IA que{" "}
            <span className="text-primary">concilia automaticamente</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Gerencie múltiplas empresas, reconcilie extratos em segundos, integre com Tiny ERP e bancos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild className="text-base">
              <Link href="/register">Começar grátis por 14 dias <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-base">
              <Link href="/precos">Ver planos e preços</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Sem cartão de crédito • Cancele quando quiser • LGPD compliant</p>
          <div className="mt-12 max-w-4xl mx-auto aspect-video bg-muted rounded-xl border flex items-center justify-center">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <svg className="h-7 w-7 text-primary ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </div>
              <p className="text-sm text-muted-foreground">Demo em breve</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[["99,9%", "Uptime Business"], ["14 dias", "Trial grátis"], ["< 2s", "Conciliação/lote"], ["LGPD", "Compliance"]].map(([v, l]) => (
            <div key={l}><p className="text-2xl font-bold text-primary">{v}</p><p className="text-sm text-muted-foreground">{l}</p></div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Tudo que seu BPO precisa</h2>
            <p className="text-muted-foreground text-lg">Funcionalidades pensadas para escritórios contábeis e BPOs financeiros.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-xl border bg-card hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4"><f.icon className="h-5 w-5 text-primary" /></div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12"><h2 className="text-3xl font-bold mb-3">Como funciona</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center mx-auto mb-4">{s.step}</div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-3">Integrações</h2>
          <p className="text-muted-foreground mb-10">Conecte com as ferramentas que sua empresa já usa.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {INTEGRATIONS.map((i) => (
              <div key={i.name} className="px-5 py-3 rounded-full border bg-card font-medium text-sm">{i.name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12"><h2 className="text-3xl font-bold">Perguntas frequentes</h2></div>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-lg border p-5">
                <p className="font-semibold mb-2">{item.q}</p>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-80" />
          <h2 className="text-3xl font-bold mb-4">Pronto para automatizar sua gestão financeira?</h2>
          <p className="text-primary-foreground/80 mb-8">Comece grátis por 14 dias. Sem cartão, sem complicação.</p>
          <Button size="lg" variant="secondary" asChild className="text-base">
            <Link href="/register">Criar conta gratuita <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}
