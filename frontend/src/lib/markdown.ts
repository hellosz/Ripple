export interface MarkdownHeading {
  id: string;
  level: number;
  text: string;
}

export function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`~!@#$%^&*()+=[\]{}|\\:;"'<>,.?/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function extractMarkdownHeadings(content: string): MarkdownHeading[] {
  const lines = content.split("\n");
  const headings: MarkdownHeading[] = [];
  const slugCount = new Map<string, number>();

  for (const line of lines) {
    const match = /^(#{2,3})\s+(.*)$/.exec(line.trim());
    if (!match) continue;

    const level = match[1].length;
    const text = match[2].trim();
    if (!text) continue;

    const baseId = slugifyHeading(text) || "section";
    const count = slugCount.get(baseId) ?? 0;
    slugCount.set(baseId, count + 1);

    headings.push({
      id: count === 0 ? baseId : `${baseId}-${count}`,
      level,
      text,
    });
  }

  return headings;
}
