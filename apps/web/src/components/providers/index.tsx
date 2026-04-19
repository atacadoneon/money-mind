"use client";

import * as React from "react";
import { ThemeProvider } from "./ThemeProvider";
import { QueryProvider } from "./QueryProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster />
          <ServiceWorkerRegistrar />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
