type AdfNode = {
  type?: string;
  text?: string;
  content?: AdfNode[];
  [key: string]: unknown;
};

export function textToAdf(text: string): AdfNode | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const paragraphs = trimmed.split(/\n{2,}/).map((paragraph) => ({
    type: "paragraph",
    content: paragraph
      .split("\n")
      .flatMap((line, index, lines) => {
        const nodes: AdfNode[] = [];
        if (line) nodes.push({ type: "text", text: line });
        if (index < lines.length - 1) nodes.push({ type: "hardBreak" });
        return nodes;
      }),
  }));

  return {
    type: "doc",
    version: 1,
    content: paragraphs,
  };
}

export function adfToText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (!value || typeof value !== "object") return undefined;

  const parts: string[] = [];
  walk(value as AdfNode, parts);
  const text = parts.join("").replace(/\n{3,}/g, "\n\n").trim();
  return text || undefined;
}

function walk(node: AdfNode, parts: string[]): void {
  if (typeof node.text === "string") parts.push(node.text);
  if (node.type === "hardBreak") parts.push("\n");
  if (node.type === "paragraph" || node.type === "heading") parts.push("\n");
  if (Array.isArray(node.content)) {
    for (const child of node.content) walk(child, parts);
  }
}
