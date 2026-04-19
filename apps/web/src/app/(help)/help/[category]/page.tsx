import { readdirSync, readFileSync, existsSync } from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: { category: string };
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of (match[1] ?? "").split("\n")) {
    const [key, ...rest] = line.split(": ");
    if (key && rest.length) fm[key.trim()] = rest.join(": ").trim();
  }
  return fm;
}

const CATEGORY_LABELS: Record<string, string> = {
  "primeiros-passos": "Primeiros Passos",
  conciliacao: "Conciliação",
  "cp-cr": "Contas a Pagar/Receber",
  relatorios: "Relatórios",
  cobranca: "Régua de Cobrança",
  billing: "Planos e Billing",
  lgpd: "LGPD e Privacidade",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const label = CATEGORY_LABELS[params.category] ?? params.category;
  return {
    title: `${label} — Central de Ajuda — Money Mind BPO`,
    description: `Artigos sobre ${label} na Central de Ajuda do Money Mind BPO.`,
  };
}

export default function HelpCategoryPage({ params }: Props) {
  const dirPath = path.join(process.cwd(), "content", "help", params.category);
  if (!existsSync(dirPath)) notFound();

  const files = readdirSync(dirPath).filter((f) => f.endsWith(".mdx"));
  const articles = files
    .map((file) => {
      const content = readFileSync(path.join(dirPath, file), "utf-8");
      const fm = parseFrontmatter(content);
      return { slug: fm.slug ?? file.replace(".mdx", ""), title: fm.title ?? file, description: fm.description ?? "", order: Number(fm.order ?? 99) };
    })
    .sort((a, b) => a.order - b.order);

  const label = CATEGORY_LABELS[params.category] ?? params.category;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/help" className="hover:text-foreground">Central de Ajuda</Link>
        <span>/</span>
        <span className="text-foreground">{label}</span>
      </div>

      <h1 className="text-3xl font-bold mb-2">{label}</h1>
      <p className="text-muted-foreground mb-8">{articles.length} artigo{articles.length !== 1 ? "s" : ""} nesta categoria</p>

      <div className="space-y-3">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/help/${params.category}/${article.slug}`}
            className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:shadow-md hover:border-primary/30 transition-all group"
          >
            <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium group-hover:text-primary transition-colors">{article.title}</p>
              {article.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{article.description}</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/help"><ChevronLeft className="h-4 w-4 mr-1" />Todas as categorias</Link>
        </Button>
      </div>
    </div>
  );
}
