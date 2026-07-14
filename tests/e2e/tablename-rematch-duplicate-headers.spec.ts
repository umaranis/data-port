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

  test("no mapping rows are shown before an append table is selected", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(0);
  });

  test("the second duplicate column is not auto-matched to the DB column", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.locator("#append-table").selectOption("employees_table");

    // Each DB column auto-matches at most one sheet column (tracked as a used index),
    // so DB "name" resolves to the FIRST sheet "name" (index 1), not the second.
    const call = await page.evaluate(() => {
      const rows = document
        .querySelectorAll("table tbody tr")
        [1]?.querySelectorAll("td");
      // Source dropdown is the 3rd cell (index 2); its selected option value is the index.
      const select = rows?.[2]?.querySelector("select") as HTMLSelectElement;
      return select?.value;
    });
    expect(call).toBe("1");
  });

  test("first duplicate column is preserved and consumes the DB entry", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.locator("#append-table").selectOption("employees_table");

    // The first "name" column wins the match; table shows 2 DB-column rows.
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows.nth(0).locator("td").nth(1)).toContainText("id");
    await expect(rows.nth(1).locator("td").nth(1)).toContainText("name");
  });

  test("second duplicate column is cleared because the DB entry is already consumed", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.locator("#append-table").selectOption("employees_table");

    // The second "name" and "dept" are cleared → only 2 DB-column rows (id, name).
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(2);
  });
});
