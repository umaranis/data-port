import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/fake/employees.xlsx";

// Sheet headers. dbColNames are auto-derived: "id", "name", "email", "dept".
const SHEET_ROWS = [
  ["id", "name", "email", "dept"],
  ["1", "Alice", "alice@example.com", "Engineering"],
];

// The two DB columns that exist in the table.
// "id" and "name" match sheet dbColNames → preserved on append.
// "email" and "dept" have no matching DB column → cleared on append.
const DB_COLUMNS = [
  { dbColName: "id", dataType: "integer" },
  { dbColName: "name", dataType: "text" },
];

async function connectToDatabase(page: Page) {
  await page.getByRole("button", { name: "Connect to Postgres" }).click();
  await page.locator("#pg-database").fill("testdb");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Connect", exact: true })
    .click();
  await expect(
    page.locator("dialog p").filter({ hasText: "Connected successfully" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3000 });
}

test.describe("append action column re-matching", () => {
  test.beforeEach(async ({ page }) => {
    await mockTauriIpc(page, {
      selectedFile: FAKE_PATH,
      sheetRows: SHEET_ROWS,
      sheetNames: ["Sheet1"],
      // "sheet1" matches the default tableName derived from "Sheet1".
      dbTables: ["sheet1"],
      dbColumns: DB_COLUMNS,
    });
    await page.goto("/");
    await connectToDatabase(page);
    await page.getByRole("button", { name: "Select Excel File" }).click();
    await expect(page.getByRole("tab", { name: "Sheet1" })).toBeVisible();
  });

  test("first sheet tab is visible after file open", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Sheet1" })).toBeVisible();
  });

  test("all dbColName inputs are filled after file load", async ({ page }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    const inputs = page.getByRole("table").locator('input[type="text"]');
    await expect(inputs.nth(0)).toHaveValue("id");
    await expect(inputs.nth(1)).toHaveValue("name");
    await expect(inputs.nth(2)).toHaveValue("email");
    await expect(inputs.nth(3)).toHaveValue("dept");
  });

  test("dbColNames not in DB are cleared when action changes to append", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();

    await page
      .getByRole("tab")
      .filter({ hasText: "Sheet1" })
      .getByRole("button", { name: "create table" })
      .click();
    await page.getByRole("option", { name: "append table" }).click();

    // "email" and "dept" have no matching column in the DB table → cleared.
    const inputs = page.getByRole("table").locator('input[type="text"]');
    await expect(inputs.nth(2)).toHaveValue("");
    await expect(inputs.nth(3)).toHaveValue("");
  });

  test("dbColNames matching a DB column are preserved when action changes to append", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();

    await page
      .getByRole("tab")
      .filter({ hasText: "Sheet1" })
      .getByRole("button", { name: "create table" })
      .click();
    await page.getByRole("option", { name: "append table" }).click();

    // "id" and "name" exist in the DB table → preserved.
    const inputs = page.getByRole("table").locator('input[type="text"]');
    await expect(inputs.nth(0)).toHaveValue("id");
    await expect(inputs.nth(1)).toHaveValue("name");
  });
});
