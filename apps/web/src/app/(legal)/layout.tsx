import type React from "react";
import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">
            Money<span className="text-primary">Mind</span> BPO
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/termos" className="hover:text-foreground transition-colors">Termos</Link>
            <Link href="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link href="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
            <Link href="/dpo" className="hover:text-foreground transition-colors">DPO</Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Money Mind BPO Financeiro. Todos os direitos reservados.</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/termos" className="hover:text-foreground">Termos de Uso</Link>
              <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
              <Link href="/cookies" className="hover:text-foreground">Cookies</Link>
              <Link href="/seguranca" className="hover:text-foreground">Segurança</Link>
              <Link href="/sla" className="hover:text-foreground">SLA</Link>
              <Link href="/dpa" className="hover:text-foreground">DPA</Link>
              <Link href="/dpo" className="hover:text-foreground">DPO</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
