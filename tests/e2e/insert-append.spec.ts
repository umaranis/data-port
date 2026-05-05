import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/fake/employees.xlsx";

const FAKE_ROWS = [
  ["id", "name", "department"],
  ["1", "Alice", "Engineering"],
  ["2", "Bob", "Marketing"],
];

// Sheet name matches the unqualified part of the DB table so the auto-select
// $effect in SheetActionOptions resolves it without manual selection.
const SHEET_NAME = "employees";
const DB_TABLE = "public.employees";

async function setup(page: Page) {
  await mockTauriIpc(page, {
    selectedFile: FAKE_PATH,
    sheetRows: FAKE_ROWS,
    sheetNames: [SHEET_NAME],
    dbTables: [DB_TABLE],
    insertedRows: 2,
  });
  await page.goto("/");
}

async function loadFile(page: Page) {
  await page.getByRole("button", { name: "Select Excel File" }).click();
  await expect(page.getByRole("tab", { name: SHEET_NAME })).toBeVisible();
}

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

async function switchToAppend(page: Page) {
  await page.getByRole("button", { name: "create table" }).click();
  await page.getByRole("option", { name: "append table" }).click();
}

async function fillColumnNames(page: Page, names: string[]) {
  await page.getByRole("button", { name: "Mapping" }).click();
  const inputs = page.getByRole("table").locator('input[type="text"]');
  for (let i = 0; i < names.length; i++) {
    await inputs.nth(i).fill(names[i]);
  }
}

test.describe("append insert flow", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await loadFile(page);
    await connectToDatabase(page);
  });

  test("auto-selects matching DB table when switching to append", async ({ page }) => {
    await switchToAppend(page);
    await expect(page.locator("#append-table")).toHaveValue(DB_TABLE);
  });

  test("inserts rows and shows success count", async ({ page }) => {
    await switchToAppend(page);
    await fillColumnNames(page, ["id", "name", "department"]);
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();
  });

  test("pg_insert_rows receives correct columnNames", async ({ page }) => {
    await switchToAppend(page);
    await fillColumnNames(page, ["id", "name", "department"]);
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const call = await page.evaluate(() => {
      const calls = (window as any).__tauriCalls__ as { cmd: string; args: any }[];
      return calls.find((c) => c.cmd === "pg_insert_rows")?.args;
    });

    expect(call).toBeDefined();
    expect(call.columnNames).toEqual(["id", "name", "department"]);
    expect(call.tableName).toBe(DB_TABLE);
  });

  test("Insert rows button is disabled without a selected table", async ({ page }) => {
    await switchToAppend(page);
    await page.locator("#append-table").selectOption("");
    await expect(
      page.getByRole("button", { name: "Insert rows" }),
    ).toBeDisabled();
  });
});
