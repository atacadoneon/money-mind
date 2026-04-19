"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require("@sentry/nextjs");
      Sentry.captureException(error);
    } catch {
      // @sentry/nextjs not installed — skip
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Erro crítico</h1>
          <p className="text-muted-foreground max-w-sm">
            A aplicação encontrou um erro grave. Por favor, tente recarregar.
          </p>
          <Button onClick={reset}>Recarregar</Button>
        </div>
      </body>
    </html>
  );
}
