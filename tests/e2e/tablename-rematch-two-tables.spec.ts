import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/fake/employees.xlsx";

// Four sheet columns: id, name, email, dept.
const SHEET_ROWS = [
  ["id", "name", "email", "dept"],
  ["1", "Alice", "alice@example.com", "Engineering"],
];

// employees_table: id + name match (2 of 4).
// products_table: id only (1 of 4).
// "employees_table" ≠ "sheet1" → tableName becomes null on append switch,
// so no re-matching happens until the user picks from the dropdown.
const DB_COLUMNS_BY_TABLE: Record<
  string,
  { dbColName: string; dataType: string }[]
> = {
  employees_table: [
    { dbColName: "id", dataType: "integer" },
    { dbColName: "name", dataType: "text" },
  ],
  products_table: [{ dbColName: "id", dataType: "integer" }],
};

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

test.describe("tableName change re-matching with two tables", () => {
  test.beforeEach(async ({ page }) => {
    await mockTauriIpc(page, {
      selectedFile: FAKE_PATH,
      sheetRows: SHEET_ROWS,
      sheetNames: ["Sheet1"],
      dbTables: ["employees_table", "products_table"],
      dbColumnsByTable: DB_COLUMNS_BY_TABLE,
    });
    await page.goto("/");
    await connectToDatabase(page);
    await page.getByRole("button", { name: "Select Excel File" }).click();
    await expect(page.getByRole("tab", { name: "Sheet1" })).toBeVisible();
    // Switch to append — "sheet1" has no match in dbTables → tableName null, no re-matching.
    await page
      .getByRole("tab")
      .filter({ hasText: "Sheet1" })
      .getByRole("button", { name: "create table" })
      .click();
    await page.getByRole("option", { name: "append table" }).click();
    await expect(page.locator("#append-table")).toBeVisible();
  });

  test("first sheet tab is visible after file open", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Sheet1" })).toBeVisible();
  });

  test("no mapping rows are shown before any table is selected", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(0);
  });

  test("selecting employees_table matches id and name, clears email and dept", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.locator("#append-table").selectOption("employees_table");

    // Table shows DB-column rows for the 2 matched columns; email/dept cleared.
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator("td").nth(1)).toContainText("id");
    await expect(rows.nth(1).locator("td").nth(1)).toContainText("name");
  });

  test("switching to products_table after employees_table clears name (only id survives)", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.locator("#append-table").selectOption("employees_table");
    await page.locator("#append-table").selectOption("products_table");

    // products_table has only "id"; name/email/dept cleared → 1 DB-column row.
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0).locator("td").nth(1)).toContainText("id");
  });

  test("switching back to employees_table re-matches id and name (cleared columns re-derive from header)", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.locator("#append-table").selectOption("employees_table");
    await page.locator("#append-table").selectOption("products_table");
    // Switch back to employees_table.
    await page.locator("#append-table").selectOption("employees_table");

    // reMatchColumnsWithDB re-derives dbColName from header for cleared columns;
    // "name" re-matches, email/dept find no match → 2 DB-column rows: id and name.
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator("td").nth(1)).toContainText("id");
    await expect(rows.nth(1).locator("td").nth(1)).toContainText("name");
  });
});
