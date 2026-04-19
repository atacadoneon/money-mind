"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ListSkeletonProps {
  rows?: number;
  rowHeight?: string;
  className?: string;
}

export function ListSkeleton({ rows = 5, rowHeight = "h-12", className }: ListSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Carregando...">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={rowHeight} />
      ))}
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, cols = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn("rounded-md border overflow-hidden", className)} aria-busy="true" aria-label="Carregando tabela...">
      {/* Header */}
      <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b last:border-0 px-4 py-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className={cn(
                "h-4",
                j === 0 ? "w-8 flex-none" : "flex-1",
                j === cols - 1 ? "w-16 flex-none" : ""
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
