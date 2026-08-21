import { parseFrontmatter, extractSkillMeta } from '../frontmatter.js';
import { estimateTokens, truncateByTokens } from './estimate.js';

export interface SkillFileInput {
  path: string;
  content: string;
  size: number;
}

export interface BuiltAiInput {
  user: string;
  truncated: boolean;
}

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** 静态事实（本地代码算出，注入 prompt——LLM 不数数） */
export function buildStaticFacts(files: SkillFileInput[], truncatedNote: boolean): string {
  const skillMd = files.find((f) => f.path === 'SKILL.md');
  const facts: string[] = [];
  if (!skillMd) {
    facts.push('- 缺少 SKILL.md（严重问题）');
    return facts.join('\n');
  }
  const meta = extractSkillMeta(parseFrontmatter(skillMd.content));
  if (meta.ok) {
    const nameOk = KEBAB_RE.test(meta.meta.name);
    facts.push(`- name="${meta.meta.name}"：${nameOk ? '符合' : '不符合'}小写-连字符命名正则`);
    facts.push(`- description 长度 ${meta.meta.description.length} 字符（上限 1024）`);
  } else {
    facts.push(`- frontmatter 非法：${meta.error}`);
  }
  const body = skillMd.content;
  const lines = body.split('\n').length;
  facts.push(
    `- SKILL.md 正文 ${lines} 行，估算 ${(estimateTokens(body) / 1000).toFixed(1)}k tokens（建议 ≤500 行 / 5k tokens）`,
  );
  const h2 = (body.match(/^## .+/gm) ?? []).map((h) => h.replace('## ', '').trim());
  facts.push(`- h2 标题：${h2.length ? h2.join(', ') : '（无）'}`);
  facts.push(`- 代码块 ${(body.match(/```/g) ?? []).length / 2 | 0} 个`);
  // 正文引用的相对路径文件是否存在
  const paths = new Set(files.map((f) => f.path));
  const refs = [...body.matchAll(/\]\(((?:references|scripts|assets)\/[\w./-]+)\)|`((?:references|scripts|assets)\/[\w./-]+)`/g)]
    .map((m) => m[1] ?? m[2])
    .filter((p): p is string => Boolean(p));
  for (const ref of [...new Set(refs)].slice(0, 12)) {
    facts.push(`- 正文引用 ${ref}（${paths.has(ref) ? '存在' : '不存在！'}）`);
  }
  const count = (prefix: string) => files.filter((f) => f.path.startsWith(prefix)).length;
  facts.push(
    `- 目录：references/(${count('references/')} 个文件) scripts/(${count('scripts/')}) assets/(${count('assets/')}) agents/(${count('agents/') ? count('agents/') : '无'})`,
  );
  if (truncatedNote) facts.push('- 注意：下文 SKILL.md 已按预算截断');
  return facts.join('\n');
}

/**
 * 组装评分/优化的 user 消息（预算裁剪：评分 ~8k、优化 ~12k tokens）。
 */
export function buildSkillAiInput(
  files: SkillFileInput[],
  mode: 'score' | 'suggest',
): BuiltAiInput {
  const skillMd = files.find((f) => f.path === 'SKILL.md');
  const mdBudget = mode === 'score' ? 5000 : 8000;
  const { text: skillMdText, truncated } = truncateByTokens(skillMd?.content ?? '（缺失）', mdBudget);

  const fileTree = files
    .slice(0, 80)
    .map((f) => `${f.path} (${f.size}B)`)
    .join('\n');

  const refFiles = files.filter((f) => f.path.startsWith('references/')).slice(0, 8);
  const referenceExcerpts = refFiles
    .map((f) => {
      const head = f.content.split('\n').slice(0, 15).join('\n').slice(0, 400);
      return `### ${f.path}\n${head}`;
    })
    .join('\n\n');

  const scriptFiles = files.filter((f) => f.path.startsWith('scripts/')).slice(0, 6);
  const scriptExcerpts = scriptFiles
    .map((f) => `### ${f.path}\n${f.content.split('\n').slice(0, 10).join('\n')}`)
    .join('\n\n');

  const user = [
    '## 静态检测结果（本地代码算出的客观事实，直接采信）',
    buildStaticFacts(files, truncated),
    '',
    '## 文件清单',
    fileTree || '（空）',
    '',
    '## SKILL.md 全文',
    skillMdText,
    '',
    '## references/ 摘要（每文件前若干行）',
    referenceExcerpts || '（无）',
    '',
    '## scripts/ 摘要（文件名 + 首部注释）',
    scriptExcerpts || '（无）',
  ].join('\n');

  return { user, truncated };
}
