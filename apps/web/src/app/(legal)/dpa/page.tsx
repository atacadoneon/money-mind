import { readFileSync } from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "DPA — Acordo de Tratamento de Dados — Money Mind BPO",
  description: "Acordo de tratamento de dados conforme a LGPD — Money Mind BPO Financeiro.",
};

export default function DpaPage() {
  let content = "";
  try {
    const filePath = path.join(process.cwd(), "..", "..", "docs", "legal", "DPA_DATA_PROCESSING_AGREEMENT.md");
    content = readFileSync(filePath, "utf-8");
  } catch {
    content = "# DPA\n\nDocumento em atualização.";
  }

  return <LegalDocument title="DPA — Acordo de Tratamento de Dados" content={content} lastUpdated="01/05/2025" />;
}
