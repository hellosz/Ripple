import { expect, test } from '@playwright/test';

test.describe('合辑与文档站', () => {
  test('合辑页展示种子合辑并可展开清单', async ({ page }) => {
    await page.goto('/collections');
    await expect(page.getByText('新手上路包').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('官方').first()).toBeVisible();
    await page.getByText(/查看清单|收起/).first().click();
    await expect(page.getByText('e2e-git-archaeologist').first()).toBeVisible();
  });

  test('文档站四篇可导航', async ({ page }) => {
    await page.goto('/docs/overview');
    await expect(page.getByText('Ripple 生态').first()).toBeVisible();
    await page.getByText('CLI 工具', { exact: true }).first().click();
    await expect(page.getByText(/npm i(nstall)? -g/).first()).toBeVisible();
    await page.getByText('桌面客户端', { exact: true }).first().click();
    await expect(page.getByText(/SSOT|中心存储/).first()).toBeVisible();
    await page.getByText('Skill 规范', { exact: true }).first().click();
    await expect(page.getByText('SKILL.md').first()).toBeVisible();
  });

  test('导航栏与页脚', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('发现', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('合辑', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('One Drop, Endless Ripples.').last()).toBeVisible();
  });
});
