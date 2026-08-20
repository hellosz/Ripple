import { expect, test } from '@playwright/test';
import { E2E_SKILL } from './global-setup';

test.describe('搜索浮层', () => {
  test('Ctrl+K 唤起、即时结果、Enter 应用、ESC 关闭', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    const input = page.getByRole('dialog', { name: '搜索' }).locator('input');
    await expect(input).toBeVisible();

    await input.fill('考古');
    await expect(page.getByText('e2e-git-archaeologist').first()).toBeVisible({ timeout: 10_000 });

    await input.press('Enter');
    await expect(input).toBeHidden();
    // 筛选说明条出现且可清除
    await expect(page.getByText(/搜索/).first()).toBeVisible();
    await expect(page.getByText(`ripple install ${E2E_SKILL}`).first()).toBeVisible();

    await page.keyboard.press('Control+k');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '搜索' })).toBeHidden();
  });
});
