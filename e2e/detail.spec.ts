import { expect, test } from '@playwright/test';
import { E2E_SKILL } from './global-setup';

test.describe('技能详情页', () => {
  test('安装条 / 统计条 / Markdown / 文件树 / 版本卡', async ({ page }) => {
    await page.goto(`/skill/${E2E_SKILL}`);
    await expect(page.getByText(`ripple install ${E2E_SKILL}`).first()).toBeVisible();
    await expect(page.getByText('热度', { exact: true }).first()).toBeVisible();
    // SKILL.md 内容渲染（Workflow 标题来自 markdown）
    await expect(page.getByText('Workflow').first()).toBeVisible();
    // 文件树包含 SKILL.md
    await expect(page.getByText('SKILL.md').first()).toBeVisible();
    // 版本卡
    await expect(page.getByText('v1.0.0').first()).toBeVisible();
  });

  test('复制安装命令给出反馈', async ({ page }) => {
    await page.goto(`/skill/${E2E_SKILL}`);
    await page.getByText('复制', { exact: true }).first().click();
    await expect(page.getByText('已复制 ✓').first()).toBeVisible();
  });

  test('未知技能显示错误态', async ({ page }) => {
    const res = await page.goto('/skill/does-not-exist-xyz');
    expect(res).not.toBeNull();
    await expect(page.getByText('没有找到这个技能').first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
