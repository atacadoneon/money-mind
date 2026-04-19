"use client";

import { useEffect } from "react";

export function useKeyboardShortcut(
  key: string,
  handler: () => void,
  opts: { meta?: boolean; ctrl?: boolean } = { meta: true, ctrl: true }
) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k !== key.toLowerCase()) return;
      if ((opts.meta && e.metaKey) || (opts.ctrl && e.ctrlKey)) {
        e.preventDefault();
        handler();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler, opts.meta, opts.ctrl]);
}
