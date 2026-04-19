import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Sobre — Money Mind BPO Financeiro",
  description: "Conheça a história e a missão do Money Mind BPO Financeiro.",
};

export default function SobrePage() {
  return (
    <div className="py-20">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-6">Sobre o Money Mind BPO</h1>

        <div className="prose-like space-y-6 text-muted-foreground leading-relaxed">
          <p className="text-lg text-foreground font-medium">
            Nascemos para resolver um problema real: a gestão financeira de pequenas e médias empresas brasileiras é travosa, manual e cara.
          </p>

          <p>
            O Money Mind BPO é uma plataforma financeira inteligente desenvolvida para contadores,
            BPOs e empresas que precisam de controle financeiro sério sem a complexidade dos ERPs tradicionais.
          </p>

          <p>
            Com IA de conciliação automática, integração nativa com Tiny ERP, Open Banking e múltiplos
            bancos, o Money Mind transforma horas de trabalho manual em segundos de automação.
          </p>

          <div className="bg-muted/30 rounded-xl p-6 border">
            <h2 className="text-xl font-bold text-foreground mb-3">Nossa missão</h2>
            <p>
              Democratizar o acesso a ferramentas de gestão financeira de qualidade para empresas
              brasileiras de todos os tamanhos — com tecnologia de ponta, compliance LGPD e suporte real.
            </p>
          </div>

          <div className="bg-muted/30 rounded-xl p-6 border">
            <h2 className="text-xl font-bold text-foreground mb-3">Localização</h2>
            <p>Cascavel, Paraná — Brasil 🇧🇷</p>
          </div>
        </div>

        <div className="mt-10">
          <Button asChild>
            <Link href="/register">
              Começar grátis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
