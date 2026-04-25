import { test, expect } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

test.beforeEach(async ({ page }) => {
  await mockTauriIpc(page);
  await page.goto("/");
});

test("shows the app title", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Data Port" })).toBeVisible();
});

test("shows the Select Excel File button", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Select Excel File" })).toBeVisible();
});

test("shows the Clear cache button", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Clear cache" })).toBeVisible();
});

test("shows the Connect to Postgres button", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Connect to Postgres" })).toBeVisible();
});

test("no sheet tabs visible before a file is loaded", async ({ page }) => {
  await expect(page.getByRole("tab")).toHaveCount(0);
});

test("Clear cache button shows feedback then reverts", async ({ page }) => {
  // Use a locator that can find the button regardless of its current text
  const btn = page.locator("button", { hasText: /Clear cache|Cache cleared/ }).first();
  await btn.click();
  await expect(page.getByRole("button", { name: "Cache cleared" })).toBeVisible({ timeout: 2000 });
  await expect(page.getByRole("button", { name: "Clear cache" })).toBeVisible({ timeout: 4000 });
});
