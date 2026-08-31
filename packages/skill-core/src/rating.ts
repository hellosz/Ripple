import type { Rating } from '@ripple/contract';

export interface RatingResult {
  rating: Rating;
  suggestions: string[];
}

/**
 * S/A/B/C 自动评级 — 行为等价移植自 Python rating_service.rate_skill：
 * S(夯) = workflow + agents/ + decision rules + desc≥50 + 代码块（无建议）
 * A(稳) = workflow + desc≥30 + h2≥3
 * B(行) = h2≥2 + desc≥20
 * 否则 C(拉)
 */
export function rateSkill(
  content: string,
  frontmatter: Record<string, unknown>,
  hasAgentsDir: boolean,
): RatingResult {
  const suggestions: string[] = [];
  const description = typeof frontmatter.description === 'string' ? frontmatter.description : '';

  const h2Headings = content.match(/^## .+/gm) ?? [];
  const h2Count = h2Headings.length;
  const h2Titles = h2Headings.map((h) => h.replace('## ', '').trim());

  const hasWorkflow = h2Titles.some(
    (t) => t.toLowerCase().includes('workflow') || t.toLowerCase().includes('architecture'),
  );
  const hasDecisionRules = h2Titles.some(
    (t) => t.toLowerCase().includes('decision') || t.toLowerCase().includes('rule'),
  );
  const hasQualityBar = h2Titles.some((t) => t.toLowerCase().includes('quality'));
  const hasOutputTemplate = /```[\s\S]*?```/.test(content);

  if (
    hasWorkflow &&
    hasAgentsDir &&
    hasDecisionRules &&
    description.length >= 50 &&
    hasOutputTemplate
  ) {
    return { rating: 'S', suggestions: [] };
  }

  if (!hasWorkflow) {
    suggestions.push("Add a '## Workflow' section describing the step-by-step process");
  }
  if (!hasAgentsDir) {
    suggestions.push("Add an 'agents/' directory with agent configuration files");
  }
  if (!hasDecisionRules) {
    suggestions.push("Add a '## Decision Rules' section");
  }
  if (description.length < 50) {
    suggestions.push(`Expand the description (currently ${description.length} chars, need ≥50)`);
  }
  if (!hasOutputTemplate) {
    suggestions.push('Include structured output templates (code blocks)');
  }
  if (!hasQualityBar) {
    suggestions.push("Add a '## Quality Bar' section with quality standards");
  }

  if (hasWorkflow && description.length >= 30 && h2Count >= 3) {
    return { rating: 'A', suggestions };
  }

  if (description.length < 30) {
    suggestions.push(
      `Expand the description to at least 30 characters (currently ${description.length})`,
    );
  }
  if (h2Count < 3) {
    suggestions.push(`Add more sections (currently ${h2Count} h2 headings, need ≥3)`);
  }

  if (h2Count >= 2 && description.length >= 20) {
    return { rating: 'B', suggestions };
  }

  if (h2Count < 2) {
    suggestions.push(`Add more sections (currently ${h2Count} h2 headings, need ≥2)`);
  }
  if (description.length < 20) {
    suggestions.push(`Add a longer description (currently ${description.length} chars, need ≥20)`);
  }

  return { rating: 'C', suggestions };
}

export function ratingLabel(rating: Rating): string {
  const labels: Record<Rating, string> = {
    S: '夯 🟢',
    A: '稳 🔵',
    B: '行 🟡',
    C: '拉 🔴',
  };
  return labels[rating];
}

/** 包内是否存在 agents/ 目录（相对技能根） */
export function hasAgentsDirectory(paths: string[]): boolean {
  return paths.some((p) => p === 'agents' || p.startsWith('agents/'));
}
