import { readFileSync } from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Política de Privacidade — Money Mind BPO",
  description: "Como tratamos seus dados pessoais na plataforma Money Mind BPO Financeiro.",
};

export default function PrivacidadePage() {
  let content = "";
  try {
    const filePath = path.join(process.cwd(), "..", "..", "docs", "legal", "POLITICA_PRIVACIDADE.md");
    content = readFileSync(filePath, "utf-8");
  } catch {
    content = "# Política de Privacidade\n\nDocumento em atualização.";
  }

  return (
    <LegalDocument
      title="Política de Privacidade"
      content={content}
      lastUpdated="01/05/2025"
    />
  );
}
