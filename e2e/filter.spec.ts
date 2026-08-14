import { test, expect } from "@playwright/test";

test("filter bar shows semantic count and bordered filter button", async ({
  page,
}) => {
  await page.goto("/");

  // semantic count label (e.g. "4 skills")
  await expect(page.getByText("skills").first()).toBeVisible();

  const filterBtn = page.getByRole("button", { name: "More filters" });
  await expect(filterBtn).toBeVisible();

  const borderWidth = await filterBtn.evaluate(
    (el) => getComputedStyle(el).borderTopWidth
  );
  expect(parseFloat(borderWidth)).toBeGreaterThan(0);
});
