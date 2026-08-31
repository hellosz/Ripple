import { expect, request, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { E2E_ADMIN } from './global-setup';

const API = `http://localhost:${process.env.E2E_API_PORT ?? 8010}`;
// 每次运行独立技能，保证互动链（copy→like→ripple）状态确定
const FLOW_SKILL = `e2e-flow-${Date.now()}`;

async function loginViaUi(page: Page): Promise<void> {
  await page.getByTitle('登录 / 注册').click();
  await page.getByPlaceholder('邮箱').fill(E2E_ADMIN.email);
  await page.getByPlaceholder('密码').fill(E2E_ADMIN.password);
  await page
    .locator('button[type="submit"]')
    .filter({ hasText: /登录|请稍候/ })
    .click();
  await expect(page.getByPlaceholder('密码')).toBeHidden({ timeout: 10_000 });
}

test.beforeAll(async () => {
  const api = await request.newContext();
  const login = await api.post(`${API}/api/auth/login`, { data: E2E_ADMIN });
  const { access_token } = (await login.json()) as { access_token: string };
  const md = `---\nname: ${FLOW_SKILL}\ndescription: 互动链 e2e 专用技能，每次运行独立创建，保证前置状态干净。\nversion: 1.0.0\n---\n\n# 互动链专用\n\n## Usage\n仅供测试。\n`;
  const zip = zipSync({ 'SKILL.md': strToU8(md) });
  const upload = await api.post(`${API}/api/skills`, {
    headers: { Authorization: `Bearer ${access_token}` },
    multipart: {
      file: { name: `${FLOW_SKILL}.zip`, mimeType: 'application/zip', buffer: Buffer.from(zip) },
      category: '工具链',
      recommendation: 'e2e 互动链',
      origin_type: 'original',
    },
  });
  expect(upload.ok()).toBe(true);
  await api.dispose();
});

test.describe.serial('登录 → 互动 → 传播（RP 前置链）', () => {
  test('前置不满足时传播被拦截，满足后传播成功', async ({ page }) => {
    await page.goto(`/skill/${FLOW_SKILL}`);
    await loginViaUi(page);

    // 前置不满足：点传播给出提示
    await page.getByText('传播', { exact: true }).last().click();
    await expect(page.getByText(/先复制|收藏|体验过/).first()).toBeVisible();

    // 复制（上报 copy）
    await page.getByText('复制', { exact: true }).first().click();
    await expect(page.getByText('已复制 ✓').first()).toBeVisible();

    // 收藏（like）
    await page.getByText('收藏', { exact: true }).last().click();
    await expect(page.getByText(/已收藏/).first()).toBeVisible({ timeout: 10_000 });

    // 传播（ripple）成功
    await page.getByText('传播', { exact: true }).last().click();
    await expect(page.getByText(/涟漪 \+1/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('个人中心展示我收藏的', async ({ page }) => {
    await page.goto('/');
    await loginViaUi(page);
    await page.goto('/me');
    await page.getByText('我收藏的').click();
    await expect(page.getByText(FLOW_SKILL).first()).toBeVisible({ timeout: 10_000 });
  });

  test('评论发布与展示', async ({ page }) => {
    await page.goto(`/skill/${FLOW_SKILL}`);
    await loginViaUi(page);
    const marker = `e2e 评论 ${Date.now()}`;
    await page.getByPlaceholder(/说点什么/).fill(marker);
    await page.getByRole('button', { name: '发布', exact: true }).click();
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 10_000 });
  });
});
