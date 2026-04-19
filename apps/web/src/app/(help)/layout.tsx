import type React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-bold text-base tracking-tight">
              Money<span className="text-primary">Mind</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/help" className="text-sm text-muted-foreground hover:text-foreground">
              Central de Ajuda
            </Link>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/login">Entrar na plataforma</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">{children}</main>

      <footer className="border-t mt-16">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Money Mind BPO</p>
          <div className="flex gap-4">
            <Link href="/termos" className="hover:text-foreground">Termos</Link>
            <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link href="/dpo" className="hover:text-foreground">DPO</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
