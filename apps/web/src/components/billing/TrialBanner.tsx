"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, useTrialDaysLeft } from "@/hooks/use-billing";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const { data: sub } = useSubscription();
  const daysLeft = useTrialDaysLeft();
  const [dismissed, setDismissed] = React.useState(false);

  if (!sub || sub.status !== "trialing" || dismissed) return null;
  if (daysLeft <= 0) return null;

  const isUrgent = daysLeft <= 3;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium border-b",
        isUrgent
          ? "bg-destructive/10 border-destructive/20 text-destructive"
          : "bg-primary/10 border-primary/20 text-primary"
      )}
    >
      <div className="flex items-center gap-2">
        {isUrgent && <AlertTriangle className="h-4 w-4 shrink-0" />}
        <span>
          {isUrgent
            ? `Urgente: seu trial expira em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}!`
            : `Você está no período de trial — ${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant={isUrgent ? "destructive" : "default"} className="h-7 text-xs" asChild>
          <Link href="/planos">Escolher plano</Link>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-current opacity-60 hover:opacity-100"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
