import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/fake/sales.xlsx";
const SHEET1 = "Employees";
const SHEET2 = "Products";

// Both sheets share the same rows in the mock. Row 0 is used as the default header;
// row 1 serves as an alternate header for headerRow=1 tests. Rows 2-3 are data rows.
const MULTI_ROWS = [
  ["id", "name", "dept"],
  ["emp_id", "full_name", "team"],
  ["1", "Alice", "Engineering"],
  ["2", "Bob", "Sales"],
];

// A persisted project with two sheets. Each sheet has one create Mapping with 3
// Column Mappings — distinct target names and non-default types — to verify
// per-sheet restore fidelity.
const MULTI_PROJECT = {
  name: "multi-sheet",
  filePath: FAKE_PATH,
  connectionString: null,
  sheets: [
    {
      name: SHEET1,
      skipped: false,
      headerRow: 0,
      skipRows: [],
      mappings: [
        {
          action: "create",
          tableName: "employees_tbl",
          columns: [
            {
              target: { dbColName: "emp_id", dataType: "integer" },
              source: { kind: "sheet", sheetColIndex: 0 },
            },
            {
              target: { dbColName: "full_name", dataType: "text" },
              source: { kind: "sheet", sheetColIndex: 1 },
            },
            {
              target: { dbColName: "department", dataType: "varchar", length: 50 },
              source: { kind: "sheet", sheetColIndex: 2 },
            },
          ],
        },
      ],
    },
    {
      name: SHEET2,
      skipped: false,
      headerRow: 0,
      skipRows: [],
      mappings: [
        {
          action: "create",
          tableName: "products_tbl",
          columns: [
            {
              target: { dbColName: "prod_id", dataType: "integer" },
              source: { kind: "sheet", sheetColIndex: 0 },
            },
            {
              target: { dbColName: "product_name", dataType: "text" },
              source: { kind: "sheet", sheetColIndex: 1 },
            },
            {
              target: { dbColName: "category", dataType: "text" },
              source: { kind: "sheet", sheetColIndex: 2 },
            },
          ],
        },
      ],
    },
  ],
};

// A persisted project where the Employees sheet uses row 1 as the header row.
const HEADERROW1_PROJECT = {
  name: "headerrow1",
  filePath: FAKE_PATH,
  connectionString: null,
  sheets: [
    {
      name: SHEET1,
      skipped: false,
      headerRow: 1,
      skipRows: [],
      mappings: [
        {
          action: "create",
          tableName: "employees_tbl",
          columns: [
            {
              target: { dbColName: "emp_id", dataType: "text" },
              source: { kind: "sheet", sheetColIndex: 0 },
            },
            {
              target: { dbColName: "full_name", dataType: "text" },
              source: { kind: "sheet", sheetColIndex: 1 },
            },
            {
              target: { dbColName: "team", dataType: "text" },
              source: { kind: "sheet", sheetColIndex: 2 },
            },
          ],
        },
      ],
    },
    {
      name: SHEET2,
      skipped: false,
      headerRow: 0,
      skipRows: [],
      mappings: [
        {
          action: "create",
          tableName: "products_tbl",
          columns: [
            {
              target: { dbColName: "id", dataType: "text" },
              source: { kind: "sheet", sheetColIndex: 0 },
            },
            {
              target: { dbColName: "name", dataType: "text" },
              source: { kind: "sheet", sheetColIndex: 1 },
            },
            {
              target: { dbColName: "dept", dataType: "text" },
              source: { kind: "sheet", sheetColIndex: 2 },
            },
          ],
        },
      ],
    },
  ],
};

// ── helpers ──────────────────────────────────────────────────────────────────

async function getLastCall(page: Page, cmd: string) {
  return page.evaluate((c) => {
    const calls = (window as any).__tauriCalls__ as {
      cmd: string;
      args: any;
    }[];
    return [...calls].reverse().find((x) => x.cmd === c)?.args;
  }, cmd);
}

async function saveProject(page: Page, name: string) {
  await page.getByRole("button", { name: "Save project" }).click();
  await page.getByPlaceholder("Project name").fill(name);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible({
    timeout: 3000,
  });
}

/**
 * Click a sheet tab by targeting the sheet-name text area, not the nested
 * action-select button.  The tab layout is: [px-4 padding][sheet name][action btn].
 * At x=30 we are past the 16 px left padding and inside the name text, well
 * before the action button (~70 px in).
 */
async function switchSheet(page: Page, sheetName: string) {
  await page
    .getByRole("tab")
    .filter({ hasText: sheetName })
    .click({ position: { x: 30, y: 16 } });
}

// ── save multi-sheet project ─────────────────────────────────────────────────

test.describe("save multi-sheet project", () => {
  test.beforeEach(async ({ page }) => {
    await mockTauriIpc(page, {
      selectedFile: FAKE_PATH,
      sheetRows: MULTI_ROWS,
      sheetNames: [SHEET1, SHEET2],
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Select Excel File" }).click();
    await expect(page.getByRole("tab", { name: SHEET1 })).toBeVisible();
    // Wait for Sheet1 content to be rendered (columns loaded).
    await expect(page.locator("#table-name")).toBeVisible();
  });

  test("payload contains both sheet names", async ({ page }) => {
    // Load Sheet2 by switching to it, then switch back to save.
    await switchSheet(page, SHEET2);
    await expect(page.locator("#table-name")).toBeVisible();

    await saveProject(page, "multi-sheet");

    const call = await getLastCall(page, "save_project");
    expect(call.payload.sheets).toHaveLength(2);
    expect(call.payload.sheets[0].name).toBe(SHEET1);
    expect(call.payload.sheets[1].name).toBe(SHEET2);
  });

  test("payload captures distinct table names per sheet", async ({ page }) => {
    await page.locator("#table-name").fill("employees_db");

    await switchSheet(page, SHEET2);
    await expect(page.locator("#table-name")).toBeVisible();
    await page.locator("#table-name").fill("products_db");

    await saveProject(page, "multi-sheet");

    const call = await getLastCall(page, "save_project");
    expect(call.payload.sheets[0].mappings[0].tableName).toBe("employees_db");
    expect(call.payload.sheets[1].mappings[0].tableName).toBe("products_db");
  });

  test("payload captures distinct column dbColNames per sheet", async ({
    page,
  }) => {
    // Rename Sheet1 columns in Mapping view.
    await page.getByRole("button", { name: "Mapping" }).click();
    const sheet1Inputs = page
      .getByRole("table")
      .locator('input[type="text"]');
    await sheet1Inputs.nth(0).fill("emp_id");
    await sheet1Inputs.nth(1).fill("full_name");
    await sheet1Inputs.nth(2).fill("department");

    // Switch to Sheet2 — view stays in "mapping" mode.
    await switchSheet(page, SHEET2);
    // Wait for the Sheet2 mapping table to appear (sheet loaded).
    await expect(
      page.getByRole("table").locator('input[type="text"]').first(),
    ).toBeVisible();
    const sheet2Inputs = page
      .getByRole("table")
      .locator('input[type="text"]');
    await sheet2Inputs.nth(0).fill("prod_id");
    await sheet2Inputs.nth(1).fill("product_name");
    await sheet2Inputs.nth(2).fill("category");

    await saveProject(page, "multi-sheet");

    const call = await getLastCall(page, "save_project");
    const s1cols = call.payload.sheets[0].mappings[0].columns;
    expect(s1cols[0].target.dbColName).toBe("emp_id");
    expect(s1cols[1].target.dbColName).toBe("full_name");
    expect(s1cols[2].target.dbColName).toBe("department");

    const s2cols = call.payload.sheets[1].mappings[0].columns;
    expect(s2cols[0].target.dbColName).toBe("prod_id");
    expect(s2cols[1].target.dbColName).toBe("product_name");
    expect(s2cols[2].target.dbColName).toBe("category");
  });

  test("payload captures column count for each sheet", async ({ page }) => {
    // Both sheets should each expose three columns (matching MULTI_ROWS header).
    await switchSheet(page, SHEET2);
    await expect(page.locator("#table-name")).toBeVisible();

    await saveProject(page, "multi-sheet");

    const call = await getLastCall(page, "save_project");
    expect(call.payload.sheets[0].mappings[0].columns).toHaveLength(3);
    expect(call.payload.sheets[1].mappings[0].columns).toHaveLength(3);
  });

  test("payload captures per-mapping action changes", async ({ page }) => {
    // Change Sheet2 action using the select inside its tab — this does NOT switch
    // the active tab because the trigger calls e.stopPropagation().
    await page
      .getByRole("tab")
      .filter({ hasText: SHEET2 })
      .getByRole("button", { name: "create table" })
      .click();
    await page.getByRole("option", { name: "re-create table" }).click();

    await saveProject(page, "multi-sheet");

    const call = await getLastCall(page, "save_project");
    expect(call.payload.sheets[0].mappings[0].action).toBe("create");
    expect(call.payload.sheets[1].mappings[0].action).toBe("recreate");
  });

  test("payload headerRow defaults to 0 for each sheet", async ({ page }) => {
    await switchSheet(page, SHEET2);
    await expect(page.locator("#table-name")).toBeVisible();

    await saveProject(page, "multi-sheet");

    const call = await getLastCall(page, "save_project");
    expect(call.payload.sheets[0].headerRow).toBe(0);
    expect(call.payload.sheets[1].headerRow).toBe(0);
  });

  test("payload skipRows is empty for each sheet by default", async ({
    page,
  }) => {
    await switchSheet(page, SHEET2);
    await expect(page.locator("#table-name")).toBeVisible();

    await saveProject(page, "multi-sheet");

    const call = await getLastCall(page, "save_project");
    expect(call.payload.sheets[0].skipRows).toEqual([]);
    expect(call.payload.sheets[1].skipRows).toEqual([]);
  });

  test("payload captures headerRow=1 after user changes header row", async ({
    page,
  }) => {
    // The #header-row input is 1-based: entering "2" sets headerRow to 1.
    await page.locator("#header-row").fill("2");
    await page.locator("#header-row").press("Tab");
    // Wait for the sheet to reload with the new header (row 1: emp_id, full_name, team),
    // which re-seeds the create Mapping's target names to the friendly headers.
    await page.getByRole("button", { name: "Mapping" }).click();
    await expect(
      page.getByRole("table").locator('input[type="text"]').first(),
    ).toHaveValue("emp_id");

    await saveProject(page, "headerrow1");

    const call = await getLastCall(page, "save_project");
    expect(call.payload.sheets[0].headerRow).toBe(1);
    const cols = call.payload.sheets[0].mappings[0].columns;
    expect(cols[0].target.dbColName).toBe("emp_id");
    expect(cols[1].target.dbColName).toBe("full_name");
    expect(cols[2].target.dbColName).toBe("team");
  });
});

// ── load multi-sheet project ──────────────────────────────────────────────────

test.describe("load multi-sheet project", () => {
  test.beforeEach(async ({ page }) => {
    await mockTauriIpc(page, {
      sheetRows: MULTI_ROWS,
      sheetNames: [SHEET1, SHEET2],
      savedProjects: ["multi-sheet"],
      savedProject: MULTI_PROJECT,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Load project" }).click();
    await page.getByRole("option", { name: "multi-sheet" }).click();
    // Wait for both sheet tabs — this means WorkbookClass.deserialize has returned.
    await expect(page.getByRole("tab", { name: SHEET1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: SHEET2 })).toBeVisible();
    // Employees is active after load; its restored table name confirms applySnapshot
    // and all column merges have settled before any test starts.
    await expect(page.locator("#table-name")).toHaveValue("employees_tbl");
  });

  test("both sheet tabs are visible", async ({ page }) => {
    await expect(page.getByRole("tab", { name: SHEET1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: SHEET2 })).toBeVisible();
  });

  test("project name appears in title", async ({ page }) => {
    await expect(page.getByText("— multi-sheet")).toBeVisible();
  });

  test("employees sheet table name is restored", async ({ page }) => {
    await expect(page.locator("#table-name")).toHaveValue("employees_tbl");
  });

  test("employees column names are restored in mapping view", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    const inputs = page.getByRole("table").locator('input[type="text"]');
    await expect(inputs.nth(0)).toHaveValue("emp_id");
    await expect(inputs.nth(1)).toHaveValue("full_name");
    await expect(inputs.nth(2)).toHaveValue("department");
  });

  test("employees column types are restored in mapping view", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    const table = page.getByRole("table");
    // "integer" and "varchar" are non-default types that confirm restore worked.
    await expect(table.getByRole("button", { name: "integer" })).toBeVisible();
    await expect(table.getByRole("button", { name: "varchar" })).toBeVisible();
  });

  test("varchar column length modifier is restored", async ({ page }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    // department column has length: 50
    await expect(page.locator('input[placeholder="length"]')).toHaveValue("50");
  });

  test("products sheet table name is restored independently", async ({
    page,
  }) => {
    await switchSheet(page, SHEET2);
    await expect(page.locator("#table-name")).toHaveValue("products_tbl");
  });

  test("products column names are restored independently from employees", async ({
    page,
  }) => {
    await switchSheet(page, SHEET2);
    await page.getByRole("button", { name: "Mapping" }).click();
    const inputs = page.getByRole("table").locator('input[type="text"]');
    await expect(inputs.nth(0)).toHaveValue("prod_id");
    await expect(inputs.nth(1)).toHaveValue("product_name");
    await expect(inputs.nth(2)).toHaveValue("category");
  });

  test("employees and products column names do not bleed into each other", async ({
    page,
  }) => {
    // Employees sheet (active): confirm emp_id, not prod_id.
    await page.getByRole("button", { name: "Mapping" }).click();
    const empInputs = page.getByRole("table").locator('input[type="text"]');
    await expect(empInputs.nth(0)).toHaveValue("emp_id");

    // Switch to Products: confirm prod_id, not emp_id.
    await switchSheet(page, SHEET2);
    await page.getByRole("button", { name: "Mapping" }).click();
    const prodInputs = page.getByRole("table").locator('input[type="text"]');
    await expect(prodInputs.nth(0)).toHaveValue("prod_id");
  });
});

// ── load project with headerRow=1 ─────────────────────────────────────────────

test.describe("load project with headerRow=1", () => {
  test.beforeEach(async ({ page }) => {
    await mockTauriIpc(page, {
      sheetRows: MULTI_ROWS,
      sheetNames: [SHEET1, SHEET2],
      savedProjects: ["headerrow1"],
      savedProject: HEADERROW1_PROJECT,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Load project" }).click();
    await page.getByRole("option", { name: "headerrow1" }).click();
    // Wait for Employees to be the active tab and its table-name to be restored.
    await expect(page.locator("#table-name")).toHaveValue("employees_tbl");
  });

  test("header row input shows 2 (1-based display of headerRow=1)", async ({
    page,
  }) => {
    await expect(page.locator("#header-row")).toHaveValue("2");
  });

  test("employees columns use restored target names", async ({ page }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    const inputs = page.getByRole("table").locator('input[type="text"]');
    await expect(inputs.nth(0)).toHaveValue("emp_id");
    await expect(inputs.nth(1)).toHaveValue("full_name");
    await expect(inputs.nth(2)).toHaveValue("team");
  });
});
