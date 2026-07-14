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

async function insertCalls(page: Page) {
  return page.evaluate(() => {
    const calls = (window as any).__tauriCalls__ as {
      cmd: string;
      args: any;
    }[];
    return calls.filter((c) => c.cmd === "pg_insert_rows").map((c) => c.args);
  });
}

test.describe("multiple mappings per sheet", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await loadFile(page);
    await connectToDatabase(page);
    await openMapping(page);
  });

  test("selector shows the single default mapping", async ({ page }) => {
    // The default create mapping is named after the sheet.
    await expect(
      page.getByRole("button", { name: SHEET_NAME, exact: true }),
    ).toBeVisible();
  });

  test("Add table creates a second mapping and selects it", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add table" }).click();
    // The new mapping's chip label falls back to "Table 2" (blank name).
    const chip = page.getByRole("button", { name: "Table 2", exact: true });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    // Its table name input is blank (a fresh create mapping).
    await expect(page.locator("#table-name")).toHaveValue("");
  });

  test("switching mappings updates the table name input", async ({ page }) => {
    await page.getByRole("button", { name: "Add table" }).click();
    await page.locator("#table-name").fill("audit");

    // Switch back to the first mapping.
    await page.getByRole("button", { name: SHEET_NAME, exact: true }).click();
    await expect(page.locator("#table-name")).toHaveValue(SHEET_NAME);

    // Switch to the second.
    await page.getByRole("button", { name: "audit", exact: true }).click();
    await expect(page.locator("#table-name")).toHaveValue("audit");
  });

  test("removing a mapping drops its chip", async ({ page }) => {
    await page.getByRole("button", { name: "Add table" }).click();
    await page.locator("#table-name").fill("audit");
    await page
      .getByRole("button", { name: "Remove table audit" })
      .click();
    await expect(
      page.getByRole("button", { name: "audit", exact: true }),
    ).toHaveCount(0);
    // The remaining single mapping has no remove control.
    await expect(
      page.getByRole("button", { name: /Remove table/ }),
    ).toHaveCount(0);
  });

  test("loading two mappings inserts into each table independently", async ({
    page,
  }) => {
    // Insert the first mapping (targets "employees").
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    // Add a second mapping targeting a different table and insert it.
    await page.getByRole("button", { name: "Add table" }).click();
    await page.locator("#table-name").fill("employees_audit");
    await page.getByRole("button", { name: "Insert rows" }).click();
    await expect(page.getByText("2 rows inserted.")).toBeVisible();

    const calls = await insertCalls(page);
    expect(calls).toHaveLength(2);
    expect(calls[0].tableName).toBe(SHEET_NAME);
    expect(calls[1].tableName).toBe("employees_audit");
  });

  test("project save round-trips two mappings on one sheet", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add table" }).click();
    await page.locator("#table-name").fill("employees_audit");

    await page.getByRole("button", { name: "Save project" }).click();
    await page.getByPlaceholder("Project name").fill("multi-map");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible({
      timeout: 3000,
    });

    const call = await page.evaluate(() => {
      const calls = (window as any).__tauriCalls__ as {
        cmd: string;
        args: any;
      }[];
      return [...calls].reverse().find((c) => c.cmd === "save_project")?.args;
    });
    const mappings = call.payload.sheets[0].mappings;
    expect(mappings).toHaveLength(2);
    expect(mappings[0].tableName).toBe(SHEET_NAME);
    expect(mappings[1].tableName).toBe("employees_audit");
  });

  test("removing an earlier mapping keeps the same one selected", async ({
    page,
  }) => {
    // Build three mappings: employees, audit, archive.
    await page.getByRole("button", { name: "Add table" }).click();
    await page.locator("#table-name").fill("audit");
    await page.getByRole("button", { name: "Add table" }).click();
    await page.locator("#table-name").fill("archive");

    // Select the middle mapping, then remove the first one.
    await page.getByRole("button", { name: "audit", exact: true }).click();
    await expect(page.locator("#table-name")).toHaveValue("audit");
    await page.getByRole("button", { name: `Remove table ${SHEET_NAME}` }).click();

    // Selection must still be on "audit", not silently jump to "archive".
    await expect(page.locator("#table-name")).toHaveValue("audit");
  });

  test("selector also appears in the Preview view", async ({ page }) => {
    await page.getByRole("button", { name: "Add table" }).click();
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByRole("button", { name: "Add table" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Table 2", exact: true }),
    ).toBeVisible();
  });
});
