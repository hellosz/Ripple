import { test, expect } from "@playwright/test";

test("nav is sticky with background and ≥24px horizontal padding", async ({
  page,
}) => {
  await page.goto("/");

  const header = page.locator("header");
  await expect(header).toBeVisible();

  const styles = await header.evaluate((el) => {
    const cs = getComputedStyle(el);
    const inner = el.firstElementChild as HTMLElement;
    const innerCs = inner ? getComputedStyle(inner) : null;
    return {
      position: cs.position,
      borderBottomWidth: cs.borderBottomWidth,
      paddingLeft: innerCs?.paddingLeft,
      paddingRight: innerCs?.paddingRight,
    };
  });

  expect(styles.position).toBe("sticky");
  expect(parseFloat(styles.borderBottomWidth)).toBeGreaterThan(0);
  expect(parseFloat(styles.paddingLeft)).toBeGreaterThanOrEqual(24);
  expect(parseFloat(styles.paddingRight)).toBeGreaterThanOrEqual(24);
});
