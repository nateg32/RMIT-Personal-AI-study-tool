import { expect, test } from "@playwright/test";

test("dashboard renders the study command centre", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /good (morning|afternoon|evening)/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/today's mission/i)).toBeVisible();
});
