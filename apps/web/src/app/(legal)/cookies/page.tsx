import { readFileSync } from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Política de Cookies — Money Mind BPO",
  description: "Como utilizamos cookies na plataforma Money Mind BPO Financeiro.",
};

export default function CookiesPage() {
  let content = "";
  try {
    const filePath = path.join(process.cwd(), "..", "..", "docs", "legal", "POLITICA_COOKIES.md");
    content = readFileSync(filePath, "utf-8");
  } catch {
    content = "# Política de Cookies\n\nDocumento em atualização.";
  }

  return <LegalDocument title="Política de Cookies" content={content} lastUpdated="01/05/2025" />;
}
