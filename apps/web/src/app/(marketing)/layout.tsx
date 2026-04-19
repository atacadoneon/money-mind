import type React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight">
            Money<span className="text-primary">Mind</span>
            <span className="ml-1.5 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">BPO</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/precos" className="text-muted-foreground hover:text-foreground transition-colors">Preços</Link>
            <Link href="/sobre" className="text-muted-foreground hover:text-foreground transition-colors">Sobre</Link>
            <Link href="/help" className="text-muted-foreground hover:text-foreground transition-colors">Ajuda</Link>
            <Link href="/contato" className="text-muted-foreground hover:text-foreground transition-colors">Contato</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <p className="font-bold text-lg mb-3">Money<span className="text-primary">Mind</span> BPO</p>
              <p className="text-sm text-muted-foreground">
                BPO Financeiro com IA para empresas brasileiras.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3">Produto</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/precos" className="block hover:text-foreground">Preços</Link>
                <Link href="/help" className="block hover:text-foreground">Central de Ajuda</Link>
                <Link href="/status" className="block hover:text-foreground">Status</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3">Empresa</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/sobre" className="block hover:text-foreground">Sobre</Link>
                <Link href="/contato" className="block hover:text-foreground">Contato</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3">Legal</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/termos" className="block hover:text-foreground">Termos de Uso</Link>
                <Link href="/privacidade" className="block hover:text-foreground">Privacidade</Link>
                <Link href="/cookies" className="block hover:text-foreground">Cookies</Link>
                <Link href="/seguranca" className="block hover:text-foreground">Segurança</Link>
                <Link href="/sla" className="block hover:text-foreground">SLA</Link>
                <Link href="/dpa" className="block hover:text-foreground">DPA</Link>
                <Link href="/dpo" className="block hover:text-foreground">DPO / LGPD</Link>
              </div>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Money Mind BPO Financeiro. Todos os direitos reservados.</p>
            <p>Feito com ❤️ no Brasil 🇧🇷</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
