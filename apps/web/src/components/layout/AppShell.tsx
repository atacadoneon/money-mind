"use client";

import * as React from "react";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export function AppShell() {
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  useKeyboardShortcuts({
    onOpenShortcuts: () => setShortcutsOpen(true)
  });

  return (
    <KeyboardShortcutsDialog
      open={shortcutsOpen}
      onOpenChange={setShortcutsOpen}
    />
  );
}
