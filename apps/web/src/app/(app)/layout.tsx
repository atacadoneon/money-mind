import { AppSidebar } from "@/components/layout/AppSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { AppShell } from "@/components/layout/AppShell";
import { TrialBanner } from "@/components/billing/TrialBanner";
import type React from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <TrialBanner />
        <main className="flex-1 overflow-x-hidden">{children}</main>
        <CommandPalette />
        <AppShell />
      </div>
    </div>
  );
}
