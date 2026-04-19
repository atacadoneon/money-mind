import { readFileSync } from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "SLA — Acordo de Nível de Serviço — Money Mind BPO",
  description: "Garantias de disponibilidade e suporte da plataforma Money Mind BPO.",
};

export default function SlaPage() {
  let content = "";
  try {
    const filePath = path.join(process.cwd(), "..", "..", "docs", "legal", "SLA.md");
    content = readFileSync(filePath, "utf-8");
  } catch {
    content = "# SLA\n\nDocumento em atualização.";
  }

  return <LegalDocument title="Acordo de Nível de Serviço (SLA)" content={content} lastUpdated="01/05/2025" />;
}
