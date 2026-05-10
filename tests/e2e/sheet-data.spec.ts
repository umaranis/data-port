import { test, expect } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/home/user/data/sales_report.xlsx";

const FAKE_ROWS = [
  ["Name", "Region", "Sales"],
  ["Alice", "North", "1200"],
  ["Bob", "South", "850"],
];

test.beforeEach(async ({ page }) => {
  await mockTauriIpc(page, { selectedFile: FAKE_PATH, sheetRows: FAKE_ROWS });
  await page.goto("/");
  await page.getByRole("button", { name: "Select Excel File" }).click();
  await expect(page.getByRole("tab", { name: "Sheet1" })).toBeVisible();
});

test("renders column headers from the first row of sheet data", async ({ page }) => {
  for (const header of FAKE_ROWS[0]) {
    await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
  }
});

test("renders data cells from subsequent rows of sheet data", async ({ page }) => {
  for (const row of FAKE_ROWS.slice(1)) {
    for (const cell of row) {
      await expect(page.getByRole("cell", { name: cell })).toBeVisible();
    }
  }
});

test("no table rows rendered when dialog is cancelled", async ({ page }) => {
  await mockTauriIpc(page, { sheetRows: FAKE_ROWS });
  await page.reload();
  await page.getByRole("button", { name: "Select Excel File" }).click();
  await expect(page.getByRole("cell", { name: "Alice" })).not.toBeAttached();
});
