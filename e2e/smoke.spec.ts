import { test, expect } from "@playwright/test";

test("home page loads with brand heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Ripples"
  );
});
