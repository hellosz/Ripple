import { describe, expect, it } from 'vitest';
import { hasAgentsDirectory, rateSkill, ratingLabel } from './rating.js';

const desc = (n: number) => 'x'.repeat(n);

// 表驱动：与 Python rating_service.rate_skill 行为逐条对齐
const CASES: Array<{
  name: string;
  content: string;
  description: string;
  hasAgentsDir: boolean;
  expected: 'S' | 'A' | 'B' | 'C';
}> = [
  {
    name: 'S：workflow + agents + decision rules + desc≥50 + 代码块',
    content: '## Workflow\nsteps\n## Decision Rules\nrules\n## Quality Bar\nq\n```\ntemplate\n```',
    description: desc(50),
    hasAgentsDir: true,
    expected: 'S',
  },
  {
    name: '缺 agents 目录 → 非 S，满足 A 条件',
    content: '## Workflow\nsteps\n## Decision Rules\nrules\n## Quality Bar\nq\n```\nt\n```',
    description: desc(50),
    hasAgentsDir: false,
    expected: 'A',
  },
  {
    name: 'A：workflow + desc≥30 + h2≥3',
    content: '## Workflow\nsteps\n## Usage\nu\n## FAQ\nf',
    description: desc(30),
    hasAgentsDir: false,
    expected: 'A',
  },
  {
    name: 'Architecture 标题也算 workflow',
    content: '## Architecture\na\n## Usage\nu\n## FAQ\nf',
    description: desc(30),
    hasAgentsDir: false,
    expected: 'A',
  },
  {
    name: 'B：h2≥2 + desc≥20（无 workflow）',
    content: '## Usage\nu\n## FAQ\nf',
    description: desc(20),
    hasAgentsDir: false,
    expected: 'B',
  },
  {
    name: 'B：有 workflow 但 desc<30',
    content: '## Workflow\nw\n## Usage\nu\n## FAQ\nf',
    description: desc(25),
    hasAgentsDir: false,
    expected: 'B',
  },
  {
    name: 'C：只有 1 个 h2',
    content: '## Usage\nu',
    description: desc(20),
    hasAgentsDir: false,
    expected: 'C',
  },
  {
    name: 'C：desc 过短',
    content: '## Usage\nu\n## FAQ\nf',
    description: desc(19),
    hasAgentsDir: false,
    expected: 'C',
  },
  {
    name: 'C：空内容',
    content: '',
    description: '',
    hasAgentsDir: false,
    expected: 'C',
  },
];

describe('rateSkill（表驱动，对齐 Python 实现）', () => {
  for (const c of CASES) {
    it(c.name, () => {
      const { rating } = rateSkill(c.content, { description: c.description }, c.hasAgentsDir);
      expect(rating).toBe(c.expected);
    });
  }

  it('S 级无改进建议', () => {
    const { suggestions } = rateSkill(
      '## Workflow\ns\n## Decision Rules\nr\n```\nt\n```',
      { description: desc(50) },
      true,
    );
    expect(suggestions).toEqual([]);
  });

  it('非 S 级返回缺失项建议（顺序与旧实现一致）', () => {
    const { rating, suggestions } = rateSkill('## Usage\nu\n## FAQ\nf', { description: desc(20) }, false);
    expect(rating).toBe('B');
    expect(suggestions).toEqual([
      "Add a '## Workflow' section describing the step-by-step process",
      "Add an 'agents/' directory with agent configuration files",
      "Add a '## Decision Rules' section",
      'Expand the description (currently 20 chars, need ≥50)',
      'Include structured output templates (code blocks)',
      "Add a '## Quality Bar' section with quality standards",
      'Expand the description to at least 30 characters (currently 20)',
      'Add more sections (currently 2 h2 headings, need ≥3)',
    ]);
  });
});

describe('辅助函数', () => {
  it('ratingLabel 输出中文标签', () => {
    expect(ratingLabel('S')).toBe('夯 🟢');
    expect(ratingLabel('C')).toBe('拉 🔴');
  });

  it('hasAgentsDirectory 识别 agents/ 前缀', () => {
    expect(hasAgentsDirectory(['agents/config.md'])).toBe(true);
    expect(hasAgentsDirectory(['references/x.md'])).toBe(false);
  });
});
