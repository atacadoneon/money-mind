import { readFileSync, existsSync } from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  params: { category: string; slug: string };
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter: Record<string, string> = {};
  const rawFrontmatter = match[1] ?? "";
  const body = match[2] ?? content;
  for (const line of rawFrontmatter.split("\n")) {
    const [key, ...rest] = line.split(": ");
    if (key && rest.length) frontmatter[key.trim()] = rest.join(": ").trim();
  }
  return { frontmatter, body };
}

function mdToHtml(md: string): string {
  return md
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3 text-foreground">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-5 mb-2 text-foreground">$2</h2>'.replace("$2", "$1"))
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-foreground">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-primary pl-4 py-1 text-muted-foreground italic my-3">$1</blockquote>')
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split("|").filter((c) => c.trim());
      if (cells.every((c) => c.trim().match(/^[-:]+$/))) return "";
      return `<tr>${cells.map((c) => `<td class="border px-3 py-2 text-sm">${c.trim()}</td>`).join("")}</tr>`;
    })
    .replace(/((?:<tr>.*?<\/tr>\n?)+)/gs, '<div class="overflow-x-auto my-4"><table class="w-full border-collapse border rounded-lg">$1</table></div>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/((?:<li.*?<\/li>\n?)+)/g, '<ul class="space-y-1.5 my-3 ml-2">$1</ul>')
    .replace(/^---$/gm, '<hr class="my-6 border-border" />')
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t || t.startsWith("<")) return line;
      return `<p class="text-muted-foreground leading-7 my-2">${t}</p>`;
    })
    .join("\n");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const filePath = path.join(
    process.cwd(),
    "content",
    "help",
    params.category,
    `${params.slug}.mdx`
  );
  if (!existsSync(filePath)) return { title: "Artigo não encontrado" };

  const { frontmatter } = parseFrontmatter(readFileSync(filePath, "utf-8"));
  return {
    title: `${frontmatter.title ?? params.slug} — Central de Ajuda — Money Mind BPO`,
    description: frontmatter.description,
  };
}

export default function HelpArticlePage({ params }: Props) {
  const filePath = path.join(
    process.cwd(),
    "content",
    "help",
    params.category,
    `${params.slug}.mdx`
  );

  if (!existsSync(filePath)) notFound();

  const raw = readFileSync(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const html = mdToHtml(body);

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/help" className="hover:text-foreground">Central de Ajuda</Link>
        <span>/</span>
        <Link href={`/help/${params.category}`} className="hover:text-foreground capitalize">
          {frontmatter.categoryLabel ?? params.category}
        </Link>
        <span>/</span>
        <span className="text-foreground">{frontmatter.title}</span>
      </div>

      {/* Article */}
      <article>
        <h1 className="text-3xl font-bold mb-2">{frontmatter.title}</h1>
        {frontmatter.description && (
          <p className="text-lg text-muted-foreground mb-6">{frontmatter.description}</p>
        )}
        <hr className="mb-6 border-border" />
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>

      {/* Feedback */}
      <div className="mt-12 rounded-xl border bg-muted/30 p-6 text-center">
        <p className="font-medium mb-3">Este artigo foi útil?</p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="sm">👍 Sim</Button>
          <Button variant="outline" size="sm">👎 Não</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Ainda com dúvidas? <a href="mailto:suporte@moneymind.com.br" className="text-primary hover:underline">suporte@moneymind.com.br</a>
        </p>
      </div>

      {/* Back */}
      <div className="mt-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/help`}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar para a Central de Ajuda
          </Link>
        </Button>
      </div>
    </div>
  );
}
