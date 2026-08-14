import { test, expect } from "@playwright/test";

test("search input is tall with a clear border", async ({ page }) => {
  await page.goto("/");

  const input = page.getByPlaceholder("Search skills...").first();
  await expect(input).toBeVisible();

  const box = await input.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);

  const borderColor = await input.evaluate(
    (el) => getComputedStyle(el).borderTopColor
  );
  // border must be a visible (non-transparent) color
  expect(borderColor).not.toBe("rgba(0, 0, 0, 0)");
});
