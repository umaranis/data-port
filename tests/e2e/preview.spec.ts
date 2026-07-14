import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/fake/employees.xlsx";

const FAKE_ROWS = [
  ["id", "name", "department"],
  ["1", "Alice", "Engineering"],
  ["2", "Bob", "Marketing"],
];

const SHEET_NAME = "employees";
const DB_TABLE = "public.employees";

async function setup(page: Page, opts: { dbTables?: string[] } = {}) {
  await mockTauriIpc(page, {
    selectedFile: FAKE_PATH,
    sheetRows: FAKE_ROWS,
    sheetNames: [SHEET_NAME],
    dbTables: opts.dbTables,
    dbColumns: [
      { dbColName: "id", dataType: "text" },
      { dbColName: "name", dataType: "text" },
      { dbColName: "department", dataType: "text" },
    ],
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

async function openMapping(page: Page) {
  await page.getByRole("button", { name: "Mapping" }).click();
}

async function openPreview(page: Page) {
  await page.getByRole("button", { name: "Preview" }).click();
}

test.describe("preview view", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await loadFile(page);
    await connectToDatabase(page);
  });

  test("Preview tab sits alongside Data and Mapping", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Data" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mapping" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
  });

  test("resolved grid shows target names and sheet values inline", async ({
    page,
  }) => {
    await openPreview(page);
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: "id" })).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "department" }),
    ).toBeVisible();
    await expect(table.getByRole("cell", { name: "Alice" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "Engineering" })).toBeVisible();
  });

  test("static Source value is shown inline in the grid", async ({ page }) => {
    await openMapping(page);
    await page.getByRole("button", { name: "Add column" }).click();
    await page
      .getByRole("table")
      .locator('input[type="text"]')
      .nth(3)
      .fill("src");
    await page
      .locator('select[aria-label="Source kind"]')
      .nth(3)
      .selectOption("static");
    await page.getByLabel("Static value").fill("CRM");

    await openPreview(page);
    // Both data rows carry the constant.
    await expect(
      page.getByRole("table").getByRole("cell", { name: "CRM" }),
    ).toHaveCount(2);
  });

  test("deferred Source renders a placeholder token", async ({ page }) => {
    await openMapping(page);
    await page.getByRole("button", { name: "Add column" }).click();
    await page
      .getByRole("table")
      .locator('input[type="text"]')
      .nth(3)
      .fill("computed");
    await page
      .locator('select[aria-label="Source kind"]')
      .nth(3)
      .selectOption("expression");

    await openPreview(page);
    await expect(
      page.getByRole("table").getByRole("cell", { name: "«expr»" }).first(),
    ).toBeVisible();
  });

  test("unmapped (none) Source column is omitted from the grid", async ({
    page,
  }) => {
    await openMapping(page);
    await page.getByRole("button", { name: "Add column" }).click();
    // New column defaults to Source kind "none" and stays unmapped.
    await openPreview(page);
    // Only the 3 seeded sheet columns are shown.
    await expect(
      page.getByRole("table").getByRole("columnheader"),
    ).toHaveCount(3);
  });

  test("generated CREATE SQL is shown for a create mapping", async ({
    page,
  }) => {
    await openPreview(page);
    await expect(page.getByLabel("Generated SQL")).toHaveValue(
      /CREATE TABLE "employees"/,
    );
  });

  test("recreate mapping shows a DROP before the CREATE", async ({ page }) => {
    await page.getByRole("button", { name: "create table" }).click();
    await page.getByRole("option", { name: "re-create table" }).click();
    await openPreview(page);
    await expect(page.getByLabel("Generated SQL")).toHaveValue(
      /DROP TABLE IF EXISTS "employees"/,
    );
  });

  test("Execute runs the DDL against the connection", async ({ page }) => {
    await openPreview(page);
    await page.getByRole("button", { name: "Execute" }).click();
    await expect(page.getByText("Executed successfully.")).toBeVisible();
    const call = await page.evaluate(() => {
      const calls = (window as any).__tauriCalls__ as {
        cmd: string;
        args: any;
      }[];
      return [...calls].reverse().find((c) => c.cmd === "pg_execute")?.args;
    });
    expect(call.sql).toContain('CREATE TABLE "employees"');
  });
});

test.describe("preview view — append", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page, { dbTables: [DB_TABLE] });
    await loadFile(page);
    await connectToDatabase(page);
    await page.getByRole("button", { name: "create table" }).click();
    await page.getByRole("option", { name: "append table" }).click();
  });

  test("append mapping shows no DDL", async ({ page }) => {
    await openPreview(page);
    await expect(page.getByLabel("Generated SQL")).toHaveCount(0);
  });

  test("append preview still resolves the sheet values", async ({ page }) => {
    await openPreview(page);
    await expect(
      page.getByRole("table").getByRole("cell", { name: "Alice" }),
    ).toBeVisible();
  });
});
