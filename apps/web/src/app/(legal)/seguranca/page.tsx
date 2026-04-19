import { readFileSync } from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Política de Segurança — Money Mind BPO",
  description: "Práticas de segurança e proteção de dados da plataforma Money Mind BPO.",
};

export default function SegurancaPage() {
  let content = "";
  try {
    const filePath = path.join(process.cwd(), "..", "..", "docs", "legal", "POLITICA_SEGURANCA.md");
    content = readFileSync(filePath, "utf-8");
  } catch {
    content = "# Política de Segurança\n\nDocumento em atualização.";
  }

  return <LegalDocument title="Política de Segurança" content={content} lastUpdated="01/05/2025" />;
}
