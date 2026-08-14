import { test, expect } from "@playwright/test";

test("hero Ripples uses brand emphasis color instead of low-contrast gray", async ({
  page,
}) => {
  await page.goto("/");

  const ripples = page.locator("h1 span").filter({ hasText: "Ripples." });
  await expect(ripples).toBeVisible();

  const color = await ripples.evaluate((el) => getComputedStyle(el).color);
  const [r, g, b] = color.match(/\d+/g)!.map(Number);

  // brand purple: blue channel clearly exceeds red channel
  expect(b).toBeGreaterThan(r);
  // not a near-invisible white/gray
  expect(color).not.toBe("rgba(255, 255, 255, 0.3)");
});
