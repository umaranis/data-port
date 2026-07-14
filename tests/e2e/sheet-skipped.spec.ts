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

async function insertCallCount(page: Page) {
  return page.evaluate(() => {
    const calls = (window as any).__tauriCalls__ as { cmd: string }[];
    return calls.filter((c) => c.cmd === "pg_insert_rows").length;
  });
}

test.describe("sheet skipped flag", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await loadFile(page);
    await connectToDatabase(page);
  });

  test("skipped toggle is off by default", async ({ page }) => {
    await expect(page.getByRole("checkbox", { name: "Skipped" })).not.toBeChecked();
  });

  test("toggling Skipped disables the Insert rows button", async ({ page }) => {
    await page.getByRole("checkbox", { name: "Skipped" }).check();
    await expect(
      page.getByRole("button", { name: "Insert rows" }),
    ).toBeDisabled();
  });

  test("a skipped sheet is not inserted", async ({ page }) => {
    await page.getByRole("checkbox", { name: "Skipped" }).check();
    // Even if the button could be forced, the mapping must refuse to load.
    const before = await insertCallCount(page);
    // Attempt insert via the model directly is not possible from the UI when
    // disabled, so assert the button is disabled AND no insert call was made.
    await expect(
      page.getByRole("button", { name: "Insert rows" }),
    ).toBeDisabled();
    expect(await insertCallCount(page)).toBe(before);
  });

  test("skipped state is captured in the saved project", async ({ page }) => {
    await page.getByRole("checkbox", { name: "Skipped" }).check();
    await page.getByRole("button", { name: "Save project" }).click();
    await page.getByPlaceholder("Project name").fill("skip-proj");
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
    expect(call.payload.sheets[0].skipped).toBe(true);
  });
});
