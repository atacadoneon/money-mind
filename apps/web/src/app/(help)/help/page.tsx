import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  CreditCard,
  BarChart3,
  Banknote,
  Shield,
  Zap,
  ArrowRight,
  Bell,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Central de Ajuda — Money Mind BPO",
  description: "Encontre respostas sobre como usar o Money Mind BPO Financeiro.",
};

const CATEGORIES = [
  {
    slug: "primeiros-passos",
    label: "Primeiros Passos",
    icon: BookOpen,
    description: "Configure sua conta e comece a usar",
    articles: [
      { slug: "bem-vindo", title: "Bem-vindo ao Money Mind BPO" },
      { slug: "configurando-primeira-empresa", title: "Configurando sua primeira empresa" },
      { slug: "integrando-tiny-erp", title: "Integrando com o Tiny ERP" },
    ],
  },
  {
    slug: "conciliacao",
    label: "Conciliação",
    icon: Zap,
    description: "Conciliação bancária automática com IA",
    articles: [
      { slug: "como-conciliar-extratos", title: "Como conciliar extratos bancários" },
      { slug: "usando-sugestoes-ia", title: "Usando as sugestões da IA" },
    ],
  },
  {
    slug: "cp-cr",
    label: "Contas a Pagar/Receber",
    icon: Banknote,
    description: "Gestão completa do financeiro",
    articles: [
      { slug: "criando-contas-a-pagar", title: "Criando contas a pagar" },
      { slug: "baixando-pagamentos", title: "Baixando pagamentos" },
      { slug: "import-em-lote", title: "Importação em lote" },
    ],
  },
  {
    slug: "relatorios",
    label: "Relatórios",
    icon: BarChart3,
    description: "DRE, Fluxo de Caixa e mais",
    articles: [
      { slug: "entendendo-o-dre", title: "Entendendo o DRE" },
      { slug: "fluxo-de-caixa-projetado", title: "Fluxo de Caixa Projetado" },
    ],
  },
  {
    slug: "cobranca",
    label: "Régua de Cobrança",
    icon: Bell,
    description: "Automação de cobranças",
    articles: [
      { slug: "regua-de-cobranca", title: "Configurando a régua de cobrança" },
    ],
  },
  {
    slug: "billing",
    label: "Planos e Billing",
    icon: CreditCard,
    description: "Assinatura, faturas e planos",
    articles: [
      { slug: "alterando-plano", title: "Alterando seu plano" },
    ],
  },
  {
    slug: "lgpd",
    label: "LGPD e Privacidade",
    icon: Shield,
    description: "Seus dados e direitos",
    articles: [
      { slug: "exportando-meus-dados", title: "Exportando meus dados (LGPD)" },
    ],
  },
];

export default function HelpHomePage() {
  return (
    <div>
      {/* Hero */}
      <div className="text-center py-12">
        <h1 className="text-3xl font-bold mb-3">Central de Ajuda</h1>
        <p className="text-muted-foreground text-lg mb-6">
          Como podemos ajudar você hoje?
        </p>
      </div>

      {/* Categories grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {CATEGORIES.map((cat) => (
          <div key={cat.slug} className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <cat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">{cat.label}</h2>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {cat.articles.map((article) => (
                <li key={article.slug}>
                  <Link
                    href={`/help/${cat.slug}/${article.slug}`}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group"
                  >
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    {article.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="mt-12 text-center rounded-xl border bg-muted/30 p-8">
        <h2 className="font-semibold text-lg mb-2">Não encontrou o que precisava?</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Nossa equipe está pronta para ajudar.
        </p>
        <a
          href="mailto:suporte@moneymind.com.br"
          className="text-primary hover:underline font-medium"
        >
          suporte@moneymind.com.br
        </a>
      </div>
    </div>
  );
}
