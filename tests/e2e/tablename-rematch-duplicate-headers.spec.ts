import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/fake/employees.xlsx";

// Two "name" columns share the same header text.
// convertToDBFriendlyName("name") → "name" for both, so both get dbColName "name".
const SHEET_ROWS = [
  ["id", "name", "name", "dept"],
  ["1", "Alice", "Ally", "Engineering"],
];

// DB has "id" and "name" but NOT "dept".
// reMatchColumnsWithDB tracks consumed DB columns in a Set so each DB entry can only
// be matched once: the first "name" column consumes the DB "name" entry and is preserved;
// the second "name" column finds no remaining match and is cleared.
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

test.describe("tableName change re-matching with duplicate column headers", () => {
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

  test("both duplicate-header columns show the same auto-derived dbColName before tableName is selected", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    const inputs = page.getByRole("table").locator('input[type="text"]');
    await expect(inputs.nth(0)).toHaveValue("id");
    await expect(inputs.nth(1)).toHaveValue("name");
    await expect(inputs.nth(2)).toHaveValue("name");
    await expect(inputs.nth(3)).toHaveValue("dept");
  });

  test("first duplicate column is preserved and consumes the DB entry", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.locator("#append-table").selectOption("employees_table");

    // The first "name" column wins the match and is preserved.
    const inputs = page.getByRole("table").locator('input[type="text"]');
    await expect(inputs.nth(0)).toHaveValue("id");
    await expect(inputs.nth(1)).toHaveValue("name");
  });

  test("second duplicate column is cleared because the DB entry is already consumed", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.locator("#append-table").selectOption("employees_table");

    // The DB "name" entry was already consumed by the first column, so the second
    // duplicate finds no remaining match and has its dbColName cleared.
    const inputs = page.getByRole("table").locator('input[type="text"]');
    await expect(inputs.nth(2)).toHaveValue("");
    await expect(inputs.nth(3)).toHaveValue("");
  });
});
