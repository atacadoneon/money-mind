import type React from "react";

interface LegalDocumentProps {
  title: string;
  content: string;
  lastUpdated?: string;
}

/**
 * Renders a legal document with basic Markdown-like formatting.
 * Uses simple regex replacements to avoid external dependencies.
 * For full markdown support, install react-markdown + remark-gfm.
 */
export function LegalDocument({ title, content, lastUpdated }: LegalDocumentProps) {
  // Convert markdown to basic HTML
  const html = content
    // Remove frontmatter if any
    .replace(/^---[\s\S]*?---\n/, "")
    // H1
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mt-8 mb-4 text-foreground first:mt-0">$1</h1>')
    // H2
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-3 text-foreground border-b pb-2">$1</h2>')
    // H3
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2 text-foreground">$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Table rows (simplified)
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split("|").filter((c) => c.trim());
      if (cells.every((c) => c.trim().match(/^[-:]+$/))) {
        return ""; // separator row
      }
      return `<tr>${cells.map((c) => `<td class="border px-3 py-2 text-sm">${c.trim()}</td>`).join("")}</tr>`;
    })
    // Wrap consecutive <tr> in table
    .replace(/((?:<tr>.*?<\/tr>\n?)+)/gs, '<div class="overflow-x-auto my-4"><table class="w-full border-collapse border rounded-lg text-sm">$1</table></div>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/((?:<li.*?<\/li>\n?)+)/g, '<ul class="space-y-1 my-3 ml-2">$1</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-8 border-border" />')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // Code inline
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Paragraphs: wrap lines not already in HTML tags
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<")) return line;
      return `<p class="text-muted-foreground leading-7 my-3">${trimmed}</p>`;
    })
    .join("\n");

  return (
    <article>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">{title}</h1>
        {lastUpdated && (
          <p className="text-sm text-muted-foreground">Última atualização: {lastUpdated}</p>
        )}
      </div>
      <div
        className="prose-like space-y-1"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
