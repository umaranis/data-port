import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/fake/employees.xlsx";

// Sheet headers. dbColNames are auto-derived: "id", "name", "email", "dept".
const SHEET_ROWS = [
  ["id", "name", "email", "dept"],
  ["1", "Alice", "alice@example.com", "Engineering"],
];

// "employees_table" does not match the default tableName "sheet1", so switching to
// append leaves tableName null and skips re-matching — all dbColNames stay filled.
// Selecting "employees_table" from the append dropdown then triggers re-matching:
// "id" and "name" are preserved; "email" and "dept" have no DB column → cleared.
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

test.describe("tableName change column re-matching", () => {
  test.beforeEach(async ({ page }) => {
    await mockTauriIpc(page, {
      selectedFile: FAKE_PATH,
      sheetRows: SHEET_ROWS,
      sheetNames: ["Sheet1"],
      // "employees_table" ≠ "sheet1" → tableName becomes null on append switch,
      // so no re-matching happens until the user selects it from the dropdown.
      dbTables: ["employees_table"],
      dbColumns: DB_COLUMNS,
    });
    await page.goto("/");
    await connectToDatabase(page);
    await page.getByRole("button", { name: "Select Excel File" }).click();
    await expect(page.getByRole("tab", { name: "Sheet1" })).toBeVisible();
    // Switch to append — tableName "sheet1" has no match in dbTables → null, no re-matching.
    await page
      .getByRole("tab")
      .filter({ hasText: "Sheet1" })
      .getByRole("button", { name: "create table" })
      .click();
    await page.getByRole("option", { name: "append table" }).click();
    // Wait for the append-table select to confirm the action UI has updated.
    await expect(page.locator("#append-table")).toBeVisible();
  });

  test("first sheet tab is visible after file open", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Sheet1" })).toBeVisible();
  });

  test("no mapping rows are shown before an append table is selected", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    // Append targets come from the DB schema; with no table chosen there are none.
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(0);
  });

  test("only the DB table's columns are shown when tableName is selected", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.locator("#append-table").selectOption("employees_table");

    // Table switches to DB-column view with only matched columns as rows.
    // "email" and "dept" cleared → only id and name rows remain.
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(2);
  });

  test("dbColNames matching a DB column are preserved when tableName is changed", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.locator("#append-table").selectOption("employees_table");

    // "id" and "name" exist in DB → shown as DB-column rows.
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows.nth(0).locator("td").nth(1)).toContainText("id");
    await expect(rows.nth(1).locator("td").nth(1)).toContainText("name");
  });
});
