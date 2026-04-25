import { test, expect } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/home/user/data/sales_report.xlsx";

test("no file path shown before a file is selected", async ({ page }) => {
  await mockTauriIpc(page);
  await page.goto("/");

  // The button exists but no path text should be visible
  await expect(page.getByRole("button", { name: "Select Excel File" })).toBeVisible();
  await expect(page.locator("p").filter({ hasText: FAKE_PATH })).not.toBeAttached();
});

test("shows file path after a file is selected", async ({ page }) => {
  await mockTauriIpc(page, { selectedFile: FAKE_PATH });
  await page.goto("/");

  await page.getByRole("button", { name: "Select Excel File" }).click();

  await expect(page.locator("p").filter({ hasText: FAKE_PATH })).toBeVisible();
});

test("does not show file path when dialog is cancelled", async ({ page }) => {
  // selectedFile omitted → dialog returns null (cancel)
  await mockTauriIpc(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Select Excel File" }).click();

  await expect(page.locator("p").filter({ hasText: "/" })).not.toBeAttached();
});

test("loads sheet tabs after a file is selected", async ({ page }) => {
  // get_sheets mock returns ["Sheet1", "Sheet2"]
  await mockTauriIpc(page, { selectedFile: FAKE_PATH });
  await page.goto("/");

  await page.getByRole("button", { name: "Select Excel File" }).click();

  await expect(page.getByRole("tab", { name: "Sheet1" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sheet2" })).toBeVisible();
});

test("selecting a new file replaces the previous path", async ({ page }) => {
  const secondPath = "/home/user/data/inventory.xlsx";

  await mockTauriIpc(page, { selectedFile: FAKE_PATH });
  await page.goto("/");

  await page.getByRole("button", { name: "Select Excel File" }).click();
  await expect(page.locator("p").filter({ hasText: FAKE_PATH })).toBeVisible();

  // Re-mock with a new file and click again — addInitScript stacks, last one wins
  await mockTauriIpc(page, { selectedFile: secondPath });
  await page.reload();
  await page.getByRole("button", { name: "Select Excel File" }).click();

  await expect(page.locator("p").filter({ hasText: secondPath })).toBeVisible();
  await expect(page.locator("p").filter({ hasText: FAKE_PATH })).not.toBeAttached();
});
