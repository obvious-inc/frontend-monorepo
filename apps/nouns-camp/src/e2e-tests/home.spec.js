import { test, expect } from "@playwright/test";

test("homepage has correct title and layout", async ({ page }) => {
  // Navigate to the homepage
  await page.goto("/");

  // Check the page title
  await expect(page).toHaveTitle(/Nouns Camp/);

  // Check for critical elements on the page
  await expect(page.locator("nav")).toBeVisible();

  // Check that the main content area is visible
  await expect(page.locator("main")).toBeVisible();
});

test("navigation links work correctly", async ({ page }) => {
  // Start from homepage
  await page.goto("/");

  // Find and click on a proposal link
  await page.locator('a[href^="/proposals/"]').first().click();

  // Check the URL has changed to proposals page
  await expect(page).toHaveURL(/\/proposals\/\d+/);
});
