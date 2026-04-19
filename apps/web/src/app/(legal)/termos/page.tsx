import { readFileSync } from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Termos de Uso — Money Mind BPO",
  description: "Termos e condições de uso da plataforma Money Mind BPO Financeiro.",
};

export default function TermosPage() {
  let content = "";
  try {
    const filePath = path.join(process.cwd(), "..", "..", "docs", "legal", "TERMOS_DE_USO.md");
    content = readFileSync(filePath, "utf-8");
  } catch {
    content = "# Termos de Uso\n\nDocumento em atualização.";
  }

  return (
    <LegalDocument
      title="Termos de Uso"
      content={content}
      lastUpdated="01/05/2025"
    />
  );
}
