"use client";

import * as React from "react";
import Link from "next/link";
import { Cookie, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "mm_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  const [prefs, setPrefs] = React.useState({
    analytics: false,
    marketing: false,
  });

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // SSR or localStorage not available
    }
  }, []);

  const save = (accepted: boolean) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accepted,
          analytics: accepted ? prefs.analytics : false,
          marketing: accepted ? prefs.marketing : false,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const acceptAll = () => {
    setPrefs({ analytics: true, marketing: true });
    save(true);
  };

  const acceptSelected = () => {
    save(true);
  };

  const rejectAll = () => {
    setPrefs({ analytics: false, marketing: false });
    save(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div className="max-w-2xl mx-auto bg-card border rounded-xl shadow-lg p-5">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm mb-1">Usamos cookies</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Utilizamos cookies essenciais para o funcionamento da plataforma e cookies opcionais
              para analytics e marketing. Veja nossa{" "}
              <Link href="/cookies" className="text-primary hover:underline">
                Política de Cookies
              </Link>
              .
            </p>

            {showDetails && (
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-not-allowed opacity-60">
                  <div className="h-4 w-4 rounded bg-primary flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                  <span>Cookies essenciais (obrigatório)</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={prefs.analytics}
                    onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
                  />
                  <span>Analytics e performance</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={prefs.marketing}
                    onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
                  />
                  <span>Marketing e comunicações</span>
                </label>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" onClick={acceptAll} className="h-7 text-xs">
                Aceitar todos
              </Button>
              {showDetails ? (
                <Button size="sm" variant="outline" onClick={acceptSelected} className="h-7 text-xs">
                  Salvar seleção
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDetails(true)}
                  className="h-7 text-xs"
                >
                  Personalizar
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={rejectAll} className="h-7 text-xs text-muted-foreground">
                Apenas essenciais
              </Button>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0 text-muted-foreground"
            onClick={rejectAll}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
