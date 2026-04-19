"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { KEYBOARD_SHORTCUTS } from "@/hooks/useKeyboardShortcuts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center gap-1 rounded border bg-muted px-2 py-0.5 font-mono text-xs">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: Props) {
  const groups = [...new Set(KEYBOARD_SHORTCUTS.map((s) => s.group))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              <div className="space-y-1.5">
                {KEYBOARD_SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <div key={s.keys} className="flex items-center justify-between gap-4">
                    <span className="text-sm">{s.description}</span>
                    <div className="shrink-0">
                      {s.keys.split(" ").map((k, i) => (
                        <span key={k}>
                          {i > 0 && <span className="mx-1 text-xs text-muted-foreground">então</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
