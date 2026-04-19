"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  collapsed?: boolean;
  children: React.ReactNode;
}

export function SidebarSection({ label, collapsed, children }: Props) {
  return (
    <div className="space-y-1">
      {!collapsed && (
        <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {label}
        </p>
      )}
      {collapsed && <div className={cn("my-2 mx-3 h-px bg-sidebar-border")} />}
      <div className="space-y-0.5 px-2">{children}</div>
    </div>
  );
}
