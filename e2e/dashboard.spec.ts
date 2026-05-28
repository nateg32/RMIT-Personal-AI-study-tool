import { expect, test } from "@playwright/test";

test("dashboard renders the study command centre", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /good morning/i })).toBeVisible();
  await expect(page.getByText(/today's mission/i)).toBeVisible();
});
