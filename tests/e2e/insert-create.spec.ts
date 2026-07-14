import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/fake/employees.xlsx";

const FAKE_ROWS = [
  ["id", "name", "department"],
  ["1", "Alice", "Engineering"],
  ["2", "Bob", "Marketing"],
];

const SHEET_NAME = "employees";
const COLUMN_NAMES = ["id", "name", "department"];

async function setup(page: Page) {
  await mockTauriIpc(page, {
    selectedFile: FAKE_PATH,
    sheetRows: FAKE_ROWS,
    sheetNames: [SHEET_NAME],
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

async function fillColumnNames(page: Page, names: string[]) {
  await page.getByRole("button", { name: "Mapping" }).click();
  const inputs = page.getByRole("table").locator('input[type="text"]');
  for (let i = 0; i < names.length; i++) {
    await inputs.nth(i).fill(names[i]);
  }
}

async function getLastInsertCall(page: Page) {
  return page.evaluate(() => {
    const calls = (window as any).__tauriCalls__ as {
      cmd: string;
      args: any;
    }[];
    return [...calls].reverse().find((c) => c.cmd === "pg_insert_rows")?.args;
  });
}

test.describe("create insert flow", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await loadFile(page);
    await connectToDatabase(page);
  });

  test("table name defaults to sheet name", async ({ page }) => {
    await expect(page.locator("#table-name")).toHaveValue(SHEET_NAME);
  });

  test("Insert button is disabled when table name is cleared", async ({
    page,
  }) => {
    await page.locator("#table-name").clear();
    await expect(
      page.getByRole("button", { name: "Insert rows" }),
    ).toBeDisabled();
  });

  test("shows error when column names are blank", async ({ page }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.getByRole("table").locator('input[type="text"]').first().clear();
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(
      page.getByText("All column names must be set before inserting."),
    ).toBeVisible();
  });

  test("pg_insert_rows is not called when column names are blank", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    await page.getByRole("table").locator('input[type="text"]').first().clear();
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(
      page.getByText("All column names must be set before inserting."),
    ).toBeVisible();
    const call = await getLastInsertCall(page);
    expect(call).toBeUndefined();
  });

  test("inserts rows and shows success count", async ({ page }) => {
    await fillColumnNames(page, COLUMN_NAMES);
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();
  });

  test("pg_insert_rows receives correct tableName", async ({ page }) => {
    await fillColumnNames(page, COLUMN_NAMES);
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const call = await getLastInsertCall(page);
    expect(call).toBeDefined();
    expect(call.tableName).toBe(SHEET_NAME);
  });

  test("pg_insert_rows receives a target per column with the right dbColName", async ({
    page,
  }) => {
    await fillColumnNames(page, COLUMN_NAMES);
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const call = await getLastInsertCall(page);
    expect(call.targets.map((t: any) => t.dbColName)).toEqual(COLUMN_NAMES);
  });

  test("pg_insert_rows targets use text as default type and sheet-index sources", async ({
    page,
  }) => {
    await fillColumnNames(page, COLUMN_NAMES);
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const call = await getLastInsertCall(page);
    expect(call.targets.map((t: any) => t.dataType)).toEqual([
      "text",
      "text",
      "text",
    ]);
    // Each create target is sourced from its own sheet column, referenced by index.
    expect(call.targets.map((t: any) => t.source)).toEqual([
      { kind: "sheet", sheetColIndex: 0 },
      { kind: "sheet", sheetColIndex: 1 },
      { kind: "sheet", sheetColIndex: 2 },
    ]);
  });

  test("custom table name is passed to pg_insert_rows", async ({ page }) => {
    await page.locator("#table-name").fill("custom_table");
    await fillColumnNames(page, COLUMN_NAMES);
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const call = await getLastInsertCall(page);
    expect(call.tableName).toBe("custom_table");
  });

  test("pg_insert_rows receives default headerRow of 0", async ({ page }) => {
    await fillColumnNames(page, COLUMN_NAMES);
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const call = await getLastInsertCall(page);
    expect(call.headerRow).toBe(0);
  });

  test("pg_insert_rows receives empty skipRows by default", async ({
    page,
  }) => {
    await fillColumnNames(page, COLUMN_NAMES);
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const call = await getLastInsertCall(page);
    expect(call.skipRows).toEqual([]);
  });
});
