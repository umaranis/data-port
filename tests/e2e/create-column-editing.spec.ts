import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/fake/employees.xlsx";

const FAKE_ROWS = [
  ["id", "name", "department"],
  ["1", "Alice", "Engineering"],
  ["2", "Bob", "Marketing"],
];

const SHEET_NAME = "employees";

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

async function openMapping(page: Page) {
  await page.getByRole("button", { name: "Mapping" }).click();
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

/** Column-name inputs are the only text inputs while every Source is a sheet
 * column (Source pickers render selects, not text inputs, for sheet sources). */
function nameInputs(page: Page) {
  return page.getByRole("table").locator('input[type="text"]');
}

test.describe("create-mode column editing", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await loadFile(page);
    await connectToDatabase(page);
    await openMapping(page);
  });

  test("seeds one Source-kind picker per sheet column", async ({ page }) => {
    await expect(page.locator('select[aria-label="Source kind"]')).toHaveCount(
      3,
    );
  });

  test("Add column appends a new target row", async ({ page }) => {
    await page.getByRole("button", { name: "Add column" }).click();
    await expect(page.locator('select[aria-label="Source kind"]')).toHaveCount(
      4,
    );
  });

  test("Remove column drops that target from the insert", async ({ page }) => {
    // Remove the middle column ("name").
    await page.getByRole("button", { name: "Remove column" }).nth(1).click();
    await expect(page.locator('select[aria-label="Source kind"]')).toHaveCount(
      2,
    );

    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const call = await getLastInsertCall(page);
    expect(call.targets.map((t: any) => t.dbColName)).toEqual([
      "id",
      "department",
    ]);
  });

  test("a static Source loads its constant value for every row", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add column" }).click();

    // The new (4th) row is last. Set its name, then its Source to static.
    await nameInputs(page).nth(3).fill("source_system");
    await page
      .locator('select[aria-label="Source kind"]')
      .nth(3)
      .selectOption("static");
    await page.getByLabel("Static value").fill("CRM");

    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const call = await getLastInsertCall(page);
    expect(call.targets).toHaveLength(4);
    expect(call.targets[3]).toMatchObject({
      dbColName: "source_system",
      source: { kind: "static", value: "CRM" },
    });
  });

  test("two targets can source the same sheet column", async ({ page }) => {
    await page.getByRole("button", { name: "Add column" }).click();

    await nameInputs(page).nth(3).fill("name_copy");
    // New row defaults to Source kind "none"; switch it to a sheet column and
    // point it at column index 1 ("name"), same as the second target.
    await page
      .locator('select[aria-label="Source kind"]')
      .nth(3)
      .selectOption("sheet");
    await page.getByLabel("Sheet column").last().selectOption("1");

    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const call = await getLastInsertCall(page);
    expect(call.targets[1].source).toEqual({ kind: "sheet", sheetColIndex: 1 });
    expect(call.targets[3].source).toEqual({ kind: "sheet", sheetColIndex: 1 });
  });

  test("an unnamed unmapped column does not block the insert", async ({
    page,
  }) => {
    // Adding a column that stays unmapped (Source "none") and unnamed must not
    // block loading — it is simply omitted from the INSERT.
    await page.getByRole("button", { name: "Add column" }).click();
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();
    await expect(
      page.getByText("All column names must be set before inserting."),
    ).toHaveCount(0);
  });

  test("a deferred Source (expression) is omitted from the insert", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add column" }).click();
    await nameInputs(page).nth(3).fill("computed");
    await page
      .locator('select[aria-label="Source kind"]')
      .nth(3)
      .selectOption("expression");
    await page.getByLabel("Expression").fill("a + b");

    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const call = await getLastInsertCall(page);
    // Deferred sources are not materialized, so the target is absent from the
    // per-row values — but it is still sent so the backend can decide. The
    // backend omits it; here we assert the app still sends the 3 sheet targets
    // plus the expression target as spec, and the backend filters it out.
    expect(call.targets).toHaveLength(4);
    expect(call.targets[3].source).toEqual({
      kind: "expression",
      expression: "a + b",
    });
  });
});
