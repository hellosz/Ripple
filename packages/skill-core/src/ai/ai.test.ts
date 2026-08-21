import { describe, expect, it } from 'vitest';
import { aiScoreRawSchema } from '@ripple/contract';
import { estimateTokens, truncateByTokens } from './estimate.js';
import { extractBalancedObject, parseLlmJson } from './parse.js';
import { AI_SCORE_WEIGHTS, computeAiTotal, gradeOfTotal } from './aggregate.js';
import { buildSkillAiInput, buildStaticFacts } from './input.js';

const dims = (score: number) =>
  (['trigger', 'disclosure', 'actionability', 'structure', 'determinism', 'clarity'] as const).map(
    (key) => ({ key, name: key, reason: 'r', score }),
  );

describe('estimateTokens / truncateByTokens', () => {
  it('中英文混合估算与预算截断', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('中文')).toBe(2);
    const long = Array.from({ length: 400 }, (_, i) => `line ${i} 内容内容内容`).join('\n');
    const { text, truncated } = truncateByTokens(long, 500);
    expect(truncated).toBe(true);
    expect(text).toContain('已截断');
    expect(text.startsWith('line 0')).toBe(true);
    expect(text.trimEnd().endsWith('line 399 内容内容内容')).toBe(true);
    expect(truncateByTokens('short', 500).truncated).toBe(false);
  });
});

describe('parseLlmJson 多级兜底', () => {
  const schema = aiScoreRawSchema;
  const valid = JSON.stringify({ dimensions: dims(80), summary: 'ok' });

  it('原生 JSON / code fence / 前后废话均可解析', () => {
    expect(parseLlmJson(valid, schema)).not.toBeNull();
    expect(parseLlmJson('```json\n' + valid + '\n```', schema)).not.toBeNull();
    expect(parseLlmJson('好的，以下是结果：\n' + valid + '\n希望有帮助！', schema)).not.toBeNull();
  });

  it('字符串含花括号不干扰括号配对', () => {
    const tricky = JSON.stringify({ dimensions: dims(70), summary: '含 } 与 { 的说明' });
    expect(parseLlmJson('前缀 ' + tricky, schema)?.summary).toContain('}');
  });

  it('非法输出返回 null', () => {
    expect(parseLlmJson('完全不是 JSON', schema)).toBeNull();
    expect(extractBalancedObject('no braces')).toBeNull();
  });
});

describe('评分聚合（客户端计算，不信 LLM 算术）', () => {
  it('权重和为 1，全 80 分 → 总分 80', () => {
    expect(Object.values(AI_SCORE_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(computeAiTotal(dims(80))).toBe(80);
  });

  it('等级映射与本地评级对齐', () => {
    expect(gradeOfTotal(85)).toBe('S');
    expect(gradeOfTotal(70)).toBe('A');
    expect(gradeOfTotal(55)).toBe('B');
    expect(gradeOfTotal(54)).toBe('C');
  });
});

describe('buildSkillAiInput / staticFacts', () => {
  const files = [
    {
      path: 'SKILL.md',
      content:
        '---\nname: demo-skill\ndescription: 演示技能\n---\n\n# Demo\n\n## Workflow\n见 `references/guide.md` 与 `references/missing.md`\n\n```bash\necho hi\n```\n',
      size: 100,
    },
    { path: 'references/guide.md', content: '# guide\n内容', size: 20 },
    { path: 'scripts/run.py', content: '#!/usr/bin/env python3\n# 入口脚本', size: 30 },
  ];

  it('静态事实：命名/行数/引用存在性/目录统计', () => {
    const facts = buildStaticFacts(files, false);
    expect(facts).toContain('name="demo-skill"：符合');
    expect(facts).toContain('references/guide.md（存在）');
    expect(facts).toContain('references/missing.md（不存在！）');
    expect(facts).toContain('references/(1 个文件)');
  });

  it('user 消息包含五个区块且 score 模式预算内', () => {
    const { user, truncated } = buildSkillAiInput(files, 'score');
    for (const section of ['静态检测结果', '文件清单', 'SKILL.md 全文', 'references/ 摘要', 'scripts/ 摘要']) {
      expect(user).toContain(section);
    }
    expect(truncated).toBe(false);
    expect(estimateTokens(user)).toBeLessThan(8000);
  });

  it('超长 SKILL.md 被截断并写入事实', () => {
    const big = [...files];
    big[0] = {
      path: 'SKILL.md',
      content:
        '---\nname: demo-skill\ndescription: d\n---\n' +
        Array.from({ length: 3000 }, (_, i) => `第 ${i} 行说明内容，包含大量文字用于撑爆预算。`).join('\n'),
      size: 1,
    };
    const { user, truncated } = buildSkillAiInput(big, 'score');
    expect(truncated).toBe(true);
    expect(user).toContain('已按预算截断');
  });
});
