/** e2e 种子：管理员账号（已知密码）、一个技能、一个合辑。全部幂等。 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { strToU8, zipSync } from 'fflate';

const API = `http://localhost:${process.env.E2E_API_PORT ?? 8010}`;
const DB = process.env.E2E_DATABASE_URL ?? 'postgresql://ripple:ripple@localhost:5433/ripple';

export const E2E_ADMIN = { email: 'admin@patpat.com', password: 'admin123456' };
export const E2E_SKILL = 'e2e-git-archaeologist';

const SKILL_MD = `---
name: ${E2E_SKILL}
description: 深挖仓库历史，自动生成变更叙事与责任图谱，让每一行祖传代码都有据可查（e2e 种子数据）。
version: 1.0.0
---

# Git 考古学家（e2e）

## Workflow
1. 建立时间线
2. 定位关键提交

## Usage
在对话中直接描述目标。

## FAQ
无。
`;

async function waitForApi(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${API}/api/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`API ${API} not reachable`);
}

async function login(): Promise<string | null> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(E2E_ADMIN),
  });
  if (!res.ok) return null;
  return ((await res.json()) as { access_token: string }).access_token;
}

async function ensureAdmin(): Promise<string> {
  let token = await login();
  if (token) return token;
  // 注册（随机密码）后用已知密码覆盖
  await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: E2E_ADMIN.email }),
  });
  const client = new pg.Client({ connectionString: DB });
  await client.connect();
  await client.query(
    `UPDATE users SET password_hash = $1, role = 'admin', status = 'active' WHERE email = $2`,
    [bcrypt.hashSync(E2E_ADMIN.password, 10), E2E_ADMIN.email],
  );
  await client.end();
  token = await login();
  if (!token) throw new Error('e2e admin login failed after seeding');
  return token;
}

async function ensureSkill(token: string): Promise<void> {
  const exists = await fetch(`${API}/api/skills/${E2E_SKILL}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (exists.ok) return;
  const zip = zipSync({ 'SKILL.md': strToU8(SKILL_MD) });
  const form = new FormData();
  form.set('file', new Blob([Buffer.from(zip)], { type: 'application/zip' }), `${E2E_SKILL}.zip`);
  form.set('category', 'GitHub 工作流');
  form.set('recommendation', '考古必备（e2e 种子）');
  form.set('origin_type', 'original');
  const res = await fetch(`${API}/api/skills`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`seed skill upload failed: ${res.status} ${await res.text()}`);
}

async function ensureCollection(token: string): Promise<void> {
  const res = await fetch(`${API}/api/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      slug: 'e2e-starter',
      name: '新手上路包',
      description: '第一次接触 Agent 技能？先把日常工作跑顺。',
      curator: '官方',
      skill_names: [E2E_SKILL],
    }),
  });
  if (!res.ok && res.status !== 200) {
    throw new Error(`seed collection failed: ${res.status} ${await res.text()}`);
  }
}

export default async function globalSetup(): Promise<void> {
  await waitForApi();
  const token = await ensureAdmin();
  await ensureSkill(token);
  await ensureCollection(token);
}
