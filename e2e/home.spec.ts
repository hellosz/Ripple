import { expect, test } from '@playwright/test';
import { E2E_SKILL } from './global-setup';

test.describe('首页', () => {
  test('Hero 与水波动画渲染', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('One Drop');
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('信息流展示种子技能与安装命令', async ({ page }) => {
    await page.goto('/');
    const card = page.getByText(`ripple install ${E2E_SKILL}`).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
  });

  test('排序 tab 切换（最热/最新）', async ({ page }) => {
    await page.goto('/');
    await page.getByText('最热', { exact: true }).first().click();
    await expect(page.getByText(`ripple install ${E2E_SKILL}`).first()).toBeVisible();
    await page.getByText('最新', { exact: true }).first().click();
    await expect(page.getByText(`ripple install ${E2E_SKILL}`).first()).toBeVisible();
  });

  test('右栏热度榜与分类 chips', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('热度榜').first()).toBeVisible();
    await expect(page.getByText('分类', { exact: true }).first()).toBeVisible();
  });
});
