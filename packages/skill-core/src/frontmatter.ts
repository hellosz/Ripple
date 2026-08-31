import { parse as parseYaml } from 'yaml';

export type Frontmatter = Record<string, unknown>;

/** 与旧实现一致：--- 开头、三段切分、YAML 解析失败返回 null */
export function parseFrontmatter(content: string): Frontmatter | null {
  if (!content.startsWith('---')) return null;
  const parts = content.split('---');
  if (parts.length < 3) return null;
  try {
    const parsed: unknown = parseYaml(parts[1] ?? '');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Frontmatter;
  } catch {
    return null;
  }
}

export function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const idx = content.indexOf('---', 3);
  if (idx === -1) return content;
  return content.slice(idx + 3).trim();
}

export interface SkillMeta {
  name: string;
  description: string;
  version: string;
  display_name: string | null;
  category: string | null;
  tags: string[] | null;
}

export type MetaResult = { ok: true; meta: SkillMeta } | { ok: false; error: string };

export function extractSkillMeta(frontmatter: Frontmatter | null): MetaResult {
  if (!frontmatter) {
    return { ok: false, error: 'SKILL.md must contain valid YAML frontmatter' };
  }
  if (typeof frontmatter.name !== 'string' || frontmatter.name.length === 0) {
    return { ok: false, error: "SKILL.md frontmatter must include 'name' field" };
  }
  if (typeof frontmatter.description !== 'string' || frontmatter.description.length === 0) {
    return { ok: false, error: "SKILL.md frontmatter must include 'description' field" };
  }
  const tags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags.filter((t): t is string => typeof t === 'string')
    : null;
  return {
    ok: true,
    meta: {
      name: frontmatter.name,
      description: frontmatter.description,
      version: typeof frontmatter.version === 'string' ? frontmatter.version : '1.0.0',
      display_name: typeof frontmatter.display_name === 'string' ? frontmatter.display_name : null,
      category: typeof frontmatter.category === 'string' ? frontmatter.category : null,
      tags,
    },
  };
}
