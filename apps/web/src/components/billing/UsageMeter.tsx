"use client";

import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  className?: string;
}

export function UsageMeter({ label, used, limit, unit = "", className }: UsageMeterProps) {
  const isUnlimited = limit >= 999999;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const isWarning = pct >= 80;
  const isDanger = pct >= 95;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className={cn("text-muted-foreground", isDanger && "text-destructive font-semibold", isWarning && !isDanger && "text-yellow-600 font-medium")}>
          {isUnlimited ? (
            <span className="text-green-600 font-medium">Ilimitado</span>
          ) : (
            `${used.toLocaleString("pt-BR")}${unit} / ${limit.toLocaleString("pt-BR")}${unit}`
          )}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={pct}
          className={cn(
            "h-2",
            isDanger && "[&>div]:bg-destructive",
            isWarning && !isDanger && "[&>div]:bg-yellow-500"
          )}
        />
      )}
    </div>
  );
}
