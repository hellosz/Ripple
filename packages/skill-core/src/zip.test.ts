import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { buildZip, readZipEntries, validateSkillZip } from './zip.js';
import { extractTextFiles, buildFileTree } from './files.js';
import { parseFrontmatter, stripFrontmatter } from './frontmatter.js';

const SKILL_MD = `---
name: git-archaeologist
description: 深挖仓库历史，自动生成变更叙事与责任图谱，让每一行祖传代码都有据可查。
version: 1.2.0
---

# Git 考古学家

## Workflow
steps
`;

function makeZip(files: Record<string, string | Uint8Array>): Uint8Array {
  const z: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) z[k] = typeof v === 'string' ? strToU8(v) : v;
  return zipSync(z);
}

describe('validateSkillZip', () => {
  it('非 ZIP 数据被拒绝', () => {
    const r = validateSkillZip(strToU8('not a zip'));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Not a valid ZIP');
  });

  it('缺少 SKILL.md 被拒绝', () => {
    const r = validateSkillZip(makeZip({ 'README.md': 'hi' }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('SKILL.md');
  });

  it('路径穿越条目导致整体失败', () => {
    const r = readZipEntries(makeZip({ '../../etc/passwd': 'evil', 'SKILL.md': SKILL_MD }));
    expect(r.entries).toBeUndefined();
    expect(r.error).toContain('Unsafe path');
  });

  it('frontmatter 缺 description 被拒绝并指明字段', () => {
    const md = '---\nname: foo\n---\n# Foo';
    const r = validateSkillZip(makeZip({ 'SKILL.md': md }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('description');
  });

  it('超过大小上限被拒绝', () => {
    const r = validateSkillZip(makeZip({ 'SKILL.md': SKILL_MD }), { maxSize: 10 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('size limit');
  });

  it('合法包解析出 meta 与技能根（含顶层目录形态）', () => {
    const r = validateSkillZip(makeZip({ 'my-skill/SKILL.md': SKILL_MD, 'my-skill/scripts/a.py': 'print(1)' }));
    expect(r.ok).toBe(true);
    expect(r.meta?.name).toBe('git-archaeologist');
    expect(r.meta?.version).toBe('1.2.0');
    expect(r.skillRoot).toBe('my-skill');
  });

  it('version 缺省为 1.0.0', () => {
    const md = '---\nname: foo\ndescription: bar\n---\n# Foo';
    const r = validateSkillZip(makeZip({ 'SKILL.md': md }));
    expect(r.ok).toBe(true);
    expect(r.meta?.version).toBe('1.0.0');
  });
});

describe('extractTextFiles', () => {
  it('跳过隐藏文件与二进制扩展名，记录语言与 sha256', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const zip = makeZip({
      'SKILL.md': SKILL_MD,
      'scripts/analyze.py': 'print("hi")',
      '.hidden/secret.md': 'x',
      'assets/logo.png': png,
    });
    const { entries } = readZipEntries(zip);
    const records = extractTextFiles(entries!, '');
    const paths = records.map((r) => r.path);
    expect(paths).toEqual(['SKILL.md', 'scripts/analyze.py']);
    const py = records.find((r) => r.path === 'scripts/analyze.py')!;
    expect(py.language).toBe('python');
    expect(py.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(py.size).toBeGreaterThan(0);
  });

  it('按 skillRoot 取相对路径', () => {
    const zip = makeZip({ 'root/SKILL.md': SKILL_MD, 'root/references/faq.md': '# FAQ' });
    const { entries } = readZipEntries(zip);
    const records = extractTextFiles(entries!, 'root');
    expect(records.map((r) => r.path).sort()).toEqual(['SKILL.md', 'references/faq.md']);
  });
});

describe('buildFileTree', () => {
  it('目录在前、字典序、含大小', () => {
    const tree = buildFileTree([
      { path: 'SKILL.md', size: 10 },
      { path: 'scripts/analyze.py', size: 20 },
      { path: 'references/faq.md', size: 5 },
    ]);
    expect(tree.map((n) => n.name)).toEqual(['references', 'scripts', 'SKILL.md']);
    expect(tree[0]?.children?.[0]).toMatchObject({ path: 'references/faq.md', type: 'file', size: 5 });
  });
});

describe('buildZip 往返', () => {
  it('打包后可再次解包且内容一致', () => {
    const zip = buildZip({ 'SKILL.md': SKILL_MD, 'a/b.txt': 'hello' });
    const { entries } = readZipEntries(zip);
    expect(new TextDecoder().decode(entries!['a/b.txt'])).toBe('hello');
  });
});

describe('frontmatter', () => {
  it('解析与剥离', () => {
    const fm = parseFrontmatter(SKILL_MD);
    expect(fm?.name).toBe('git-archaeologist');
    expect(stripFrontmatter(SKILL_MD).startsWith('# Git 考古学家')).toBe(true);
  });

  it('非 frontmatter 内容返回 null', () => {
    expect(parseFrontmatter('# no frontmatter')).toBeNull();
    expect(parseFrontmatter('---\n[1,2]\n---\nx')).toBeNull();
  });
});
