"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/ui";

type Handler = () => void;

interface Shortcut {
  keys: string; // display string
  description: string;
  group: string;
}

export const KEYBOARD_SHORTCUTS: Shortcut[] = [
  { keys: "?", description: "Abrir atalhos de teclado", group: "Geral" },
  { keys: "Ctrl+K", description: "Abrir command palette", group: "Geral" },
  { keys: "Esc", description: "Fechar modal / cancelar seleção", group: "Geral" },
  { keys: "/", description: "Focar busca", group: "Geral" },
  { keys: "g i", description: "Ir para Início", group: "Navegação" },
  { keys: "g p", description: "Ir para Contas a Pagar", group: "Navegação" },
  { keys: "g r", description: "Ir para Contas a Receber", group: "Navegação" },
  { keys: "g c", description: "Ir para Conciliação", group: "Navegação" },
  { keys: "n p", description: "Nova Conta a Pagar", group: "Criação" },
  { keys: "n r", description: "Nova Conta a Receber", group: "Criação" },
  { keys: "n c", description: "Novo Contato", group: "Criação" }
];

export function useKeyboardShortcuts(callbacks?: {
  onNewCP?: Handler;
  onNewCR?: Handler;
  onNewContato?: Handler;
  onOpenShortcuts?: Handler;
}) {
  const router = useRouter();
  const { setCommandPaletteOpen } = useUIStore();
  const seqRef = useRef<string[]>([]);
  const seqTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select" ||
        (e.target as HTMLElement)?.contentEditable === "true";

      // Ctrl+K / Cmd+K — always active
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Skip shortcuts in inputs (except Esc)
      if (isInput && e.key !== "Escape") return;

      // ? — open shortcuts dialog
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        callbacks?.onOpenShortcuts?.();
        return;
      }

      // / — focus search
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const searchBtn = document.querySelector<HTMLButtonElement>(
          "[data-search-trigger]"
        );
        searchBtn?.click();
        return;
      }

      // Sequence shortcuts (g i, g p, g r, g c, n p, n r, n c)
      const key = e.key.toLowerCase();
      if (["g", "n"].includes(key)) {
        seqRef.current = [key];
        if (seqTimeout.current) clearTimeout(seqTimeout.current);
        seqTimeout.current = setTimeout(() => { seqRef.current = []; }, 1500);
        return;
      }

      if (seqRef.current.length === 1) {
        const seq = seqRef.current[0] + key;
        seqRef.current = [];
        if (seqTimeout.current) clearTimeout(seqTimeout.current);

        switch (seq) {
          case "gi": router.push("/inicio"); break;
          case "gp": router.push("/financas/contas-a-pagar"); break;
          case "gr": router.push("/financas/contas-a-receber"); break;
          case "gc": router.push("/financas/conciliacao"); break;
          case "np": callbacks?.onNewCP?.(); break;
          case "nr": callbacks?.onNewCR?.(); break;
          case "nc": callbacks?.onNewContato?.(); break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (seqTimeout.current) clearTimeout(seqTimeout.current);
    };
  }, [router, setCommandPaletteOpen, callbacks]);
}
