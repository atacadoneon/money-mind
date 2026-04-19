"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to Sentry if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require("@sentry/nextjs");
      Sentry.captureException(error);
    } catch {
      // @sentry/nextjs not installed — skip
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div>
        <h2 className="text-xl font-bold">Algo deu errado</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">
          Ocorreu um erro inesperado. A equipe já foi notificada.
          {error.digest && (
            <span className="block mt-1 font-mono text-xs opacity-60">
              Ref: {error.digest}
            </span>
          )}
        </p>
      </div>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
