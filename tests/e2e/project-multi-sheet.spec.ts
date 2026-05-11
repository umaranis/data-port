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

// A persisted project with two sheets.  Each sheet has 3 columns with distinct
// dbColNames and non-default data types to verify per-sheet restore fidelity.
const MULTI_PROJECT = {
  name: "multi-sheet",
  filePath: FAKE_PATH,
  connectionString: null,
  sheets: [
    {
      name: SHEET1,
      action: "create",
      tableName: "employees_tbl",
      headerRow: 0,
      skipRows: [],
      columns: [
        {
          type: "sheet",
          header: "id",
          dataType: "integer",
          dbColName: "emp_id",
          excluded: false,
        },
        {
          type: "sheet",
          header: "name",
          dataType: "text",
          dbColName: "full_name",
          excluded: false,
        },
        {
          type: "sheet",
          header: "dept",
          dataType: "varchar",
          length: 50,
          dbColName: "department",
          excluded: false,
        },
      ],
    },
    {
      name: SHEET2,
      action: "skip",
      tableName: null,
      headerRow: 0,
      skipRows: [],
      columns: [
        {
          type: "sheet",
          header: "id",
          dataType: "integer",
          dbColName: "prod_id",
          excluded: false,
        },
        {
          type: "sheet",
          header: "name",
          dataType: "text",
          dbColName: "product_name",
          excluded: false,
        },
        {
          type: "sheet",
          header: "dept",
          dataType: "text",
          dbColName: "category",
          excluded: false,
        },
      ],
    },
  ],
};

// A persisted project where the Employees sheet uses row 1 as the header row.
// Columns match MULTI_ROWS[1] so applySnapshot can merge them by header name.
const HEADERROW1_PROJECT = {
  name: "headerrow1",
  filePath: FAKE_PATH,
  connectionString: null,
  sheets: [
    {
      name: SHEET1,
      action: "create",
      tableName: "employees_tbl",
      headerRow: 1,
      skipRows: [],
      columns: [
        {
          type: "sheet",
          header: "emp_id",
          dataType: "text",
          dbColName: "emp_id",
          excluded: false,
        },
        {
          type: "sheet",
          header: "full_name",
          dataType: "text",
          dbColName: "full_name",
          excluded: false,
        },
        {
          type: "sheet",
          header: "team",
          dataType: "text",
          dbColName: "team",
          excluded: false,
        },
      ],
    },
    {
      name: SHEET2,
      action: "create",
      tableName: "products_tbl",
      headerRow: 0,
      skipRows: [],
      columns: [
        {
          type: "sheet",
          header: "id",
          dataType: "text",
          dbColName: "id",
          excluded: false,
        },
        {
          type: "sheet",
          header: "name",
          dataType: "text",
          dbColName: "name",
          excluded: false,
        },
        {
          type: "sheet",
          header: "dept",
          dataType: "text",
          dbColName: "dept",
          excluded: false,
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
    expect(call.payload.sheets[0].tableName).toBe("employees_db");
    expect(call.payload.sheets[1].tableName).toBe("products_db");
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
    const s1cols = call.payload.sheets[0].columns;
    expect(s1cols[0].dbColName).toBe("emp_id");
    expect(s1cols[1].dbColName).toBe("full_name");
    expect(s1cols[2].dbColName).toBe("department");

    const s2cols = call.payload.sheets[1].columns;
    expect(s2cols[0].dbColName).toBe("prod_id");
    expect(s2cols[1].dbColName).toBe("product_name");
    expect(s2cols[2].dbColName).toBe("category");
  });

  test("payload captures column count for each sheet", async ({ page }) => {
    // Both sheets should each expose three columns (matching MULTI_ROWS header).
    await switchSheet(page, SHEET2);
    await expect(page.locator("#table-name")).toBeVisible();

    await saveProject(page, "multi-sheet");

    const call = await getLastCall(page, "save_project");
    expect(call.payload.sheets[0].columns).toHaveLength(3);
    expect(call.payload.sheets[1].columns).toHaveLength(3);
  });

  test("payload captures sheet action changes", async ({ page }) => {
    // Change Sheet2 action using the select inside its tab — this does NOT switch
    // the active tab because the trigger calls e.stopPropagation().
    await page
      .getByRole("tab")
      .filter({ hasText: SHEET2 })
      .getByRole("button", { name: "create table" })
      .click();
    await page.getByRole("option", { name: "skip sheet" }).click();

    await saveProject(page, "multi-sheet");

    const call = await getLastCall(page, "save_project");
    expect(call.payload.sheets[0].action).toBe("create");
    expect(call.payload.sheets[1].action).toBe("skip");
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
    // Wait for the sheet to reload with the new header (row 1: emp_id, full_name, team).
    await page.getByRole("button", { name: "Mapping" }).click();
    await expect(
      page.getByRole("table").locator('input[type="text"]').first(),
    ).toHaveValue("emp_id");

    await saveProject(page, "headerrow1");

    const call = await getLastCall(page, "save_project");
    expect(call.payload.sheets[0].headerRow).toBe(1);
    expect(call.payload.sheets[0].columns[0].header).toBe("emp_id");
    expect(call.payload.sheets[0].columns[1].header).toBe("full_name");
    expect(call.payload.sheets[0].columns[2].header).toBe("team");
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
    // "skip sheet" appearing in the Products tab confirms applySnapshot ran for Sheet2
    // and all microtasks (including column merges) have settled before any test starts.
    await expect(page.getByText("skip sheet")).toBeVisible();
  });

  test("both sheet tabs are visible", async ({ page }) => {
    // Already asserted in beforeEach; re-assert for clarity as a standalone test.
    await expect(page.getByRole("tab", { name: SHEET1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: SHEET2 })).toBeVisible();
  });

  test("project name appears in title", async ({ page }) => {
    await expect(page.getByText("— multi-sheet")).toBeVisible();
  });

  test("employees sheet table name is restored", async ({ page }) => {
    // Employees is the active sheet after load.
    await expect(page.locator("#table-name")).toHaveValue("employees_tbl");
  });

  test("employees column names are restored in mapping view", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    const inputs = page.getByRole("table").locator('input[type="text"]');
    // applySnapshot merges saved dbColNames; Playwright retries until settled.
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

  test("products sheet action is restored to skip", async ({ page }) => {
    // "skip sheet" text appears in the Products tab action select trigger.
    // Action is set synchronously by applySnapshot before loadSheet runs.
    await expect(page.getByText("skip sheet")).toBeVisible();
  });

  test("products tab does not show table name input (skip action)", async ({
    page,
  }) => {
    await switchSheet(page, SHEET2);
    // "skip" action renders an empty div in SheetActionOptions — no #table-name.
    await expect(page.locator("#table-name")).not.toBeVisible();
  });

  test("products column names are restored independently from employees", async ({
    page,
  }) => {
    await switchSheet(page, SHEET2);
    // Wait for the mapping table to appear after Products loads.
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

  test("employees columns use headers from row 1 after restore", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mapping" }).click();
    const inputs = page.getByRole("table").locator('input[type="text"]');
    await expect(inputs.nth(0)).toHaveValue("emp_id");
    await expect(inputs.nth(1)).toHaveValue("full_name");
    await expect(inputs.nth(2)).toHaveValue("team");
  });
});
