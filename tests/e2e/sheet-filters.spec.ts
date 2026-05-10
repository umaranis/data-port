import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/fake/report.xlsx";

const FAKE_ROWS = [
  ["Name", "Region", "Sales"],
  ["Alice", "North", "1200"],
  ["Bob", "South", "850"],
  ["Charlie", "East", "970"],
];

async function setup(page: Page, extra: Parameters<typeof mockTauriIpc>[1] = {}) {
  await mockTauriIpc(page, {
    selectedFile: FAKE_PATH,
    sheetRows: FAKE_ROWS,
    sheetNames: ["Sheet1"],
    ...extra,
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Select Excel File" }).click();
  await expect(page.locator("#header-row")).toBeVisible();
}

function headerRowInput(page: Page) {
  return page.locator("#header-row");
}

function skipRowsInput(page: Page) {
  return page.locator("#skip-rows");
}

function findBlankButton(page: Page) {
  return page.getByRole("button", { name: "Find blank rows" });
}

// ─── Initial state ───────────────────────────────────────────────────────────

test.describe("initial state", () => {
  test("header row defaults to 1", async ({ page }) => {
    await setup(page);
    await expect(headerRowInput(page)).toHaveValue("1");
  });

  test("skip rows input is empty", async ({ page }) => {
    await setup(page);
    await expect(skipRowsInput(page)).toHaveValue("");
  });

  test("hidden row count is not shown", async ({ page }) => {
    await setup(page);
    await expect(page.getByText(/rows? hidden/)).not.toBeAttached();
  });
});

// ─── Applying skip rows ───────────────────────────────────────────────────────

test.describe("applying skip rows", () => {
  test("shows hidden row count after applying", async ({ page }) => {
    await setup(page);
    await skipRowsInput(page).fill("2,3");
    await skipRowsInput(page).press("Tab");
    await expect(page.getByText("2 rows hidden")).toBeVisible();
  });

  test("singular label for one skipped row", async ({ page }) => {
    await setup(page);
    await skipRowsInput(page).fill("2");
    await skipRowsInput(page).press("Tab");
    await expect(page.getByText("1 row hidden")).toBeVisible();
  });

  test("get_sheet_rows_paged_filtered called with correct skipRows", async ({ page }) => {
    await setup(page);
    await skipRowsInput(page).fill("2,3");
    await skipRowsInput(page).press("Tab");

    const calls = await page.evaluate(
      () => (window as any).__tauriCalls__ as { cmd: string; args: any }[]
    );
    const last = [...calls]
      .reverse()
      .find((c) => c.cmd === "get_sheet_rows_paged_filtered");

    expect(last).toBeDefined();
    expect(last!.args.skipRows).toEqual([2, 3]);
  });

  test("get_sheet_rows_paged_filtered called with page reset to 0", async ({ page }) => {
    await setup(page);
    await skipRowsInput(page).fill("2");
    await skipRowsInput(page).press("Tab");

    const calls = await page.evaluate(
      () => (window as any).__tauriCalls__ as { cmd: string; args: any }[]
    );
    const last = [...calls]
      .reverse()
      .find((c) => c.cmd === "get_sheet_rows_paged_filtered");

    expect(last!.args.page).toBe(0);
  });

  test("range syntax expands correctly in skipRows arg", async ({ page }) => {
    await setup(page);
    await skipRowsInput(page).fill("2-4");
    await skipRowsInput(page).press("Tab");

    const calls = await page.evaluate(
      () => (window as any).__tauriCalls__ as { cmd: string; args: any }[]
    );
    const last = [...calls]
      .reverse()
      .find((c) => c.cmd === "get_sheet_rows_paged_filtered");

    expect(last!.args.skipRows).toEqual([2, 3, 4]);
  });

  test("clearing skip rows input and applying removes hidden count", async ({ page }) => {
    await setup(page);
    await skipRowsInput(page).fill("2");
    await skipRowsInput(page).press("Tab");
    await expect(page.getByText("1 row hidden")).toBeVisible();

    await skipRowsInput(page).fill("");
    await skipRowsInput(page).press("Tab");
    await expect(page.getByText(/rows? hidden/)).not.toBeAttached();
  });
});

// ─── Applying header row ─────────────────────────────────────────────────────

test.describe("applying header row", () => {
  test("get_sheet_rows_paged_filtered called with correct headerRow", async ({ page }) => {
    await setup(page);
    await headerRowInput(page).fill("2");
    await headerRowInput(page).press("Tab");

    const calls = await page.evaluate(
      () => (window as any).__tauriCalls__ as { cmd: string; args: any }[]
    );
    const last = [...calls]
      .reverse()
      .find((c) => c.cmd === "get_sheet_rows_paged_filtered");

    expect(last!.args.headerRow).toBe(1);
  });
});

// ─── Enter key ───────────────────────────────────────────────────────────────

test.describe("Enter key behaviour", () => {
  test("Enter in header row input applies filters when there are changes", async ({ page }) => {
    await setup(page);
    await headerRowInput(page).fill("2");
    await headerRowInput(page).press("Enter");

    const calls = await page.evaluate(
      () => (window as any).__tauriCalls__ as { cmd: string; args: any }[]
    );
    const last = [...calls]
      .reverse()
      .find((c) => c.cmd === "get_sheet_rows_paged_filtered");

    expect(last!.args.headerRow).toBe(1);
  });

  test("Enter in skip rows input applies filters when there are changes", async ({ page }) => {
    await setup(page);
    await skipRowsInput(page).fill("2");
    await skipRowsInput(page).press("Enter");
    await expect(page.getByText("1 row hidden")).toBeVisible();
  });

  test("Enter in header row input does nothing when no changes", async ({ page }) => {
    await setup(page);
    const callsBefore = await page.evaluate(
      () => ((window as any).__tauriCalls__ as { cmd: string }[]).length
    );
    await headerRowInput(page).press("Enter");
    const callsAfter = await page.evaluate(
      () => ((window as any).__tauriCalls__ as { cmd: string }[]).length
    );
    expect(callsAfter).toBe(callsBefore);
  });
});

// ─── Find blank rows ─────────────────────────────────────────────────────────

test.describe("Find blank rows", () => {
  test("populates skip rows input from get_blank_rows response", async ({ page }) => {
    await setup(page, { blankRows: [3, 5] });
    await findBlankButton(page).click();
    await expect(skipRowsInput(page)).toHaveValue("3,5");
  });

  test("merges blank rows with already-entered skip rows", async ({ page }) => {
    await setup(page, { blankRows: [5] });
    await skipRowsInput(page).fill("2");
    await findBlankButton(page).click();
    await expect(skipRowsInput(page)).toHaveValue("2,5");
  });

  test("does not change input when no blank rows found", async ({ page }) => {
    await setup(page, { blankRows: [] });
    await skipRowsInput(page).fill("2");
    await findBlankButton(page).click();
    await expect(skipRowsInput(page)).toHaveValue("2");
  });

  test("get_blank_rows called with correct args", async ({ page }) => {
    await setup(page, { blankRows: [3] });
    await findBlankButton(page).click();

    const calls = await page.evaluate(
      () => (window as any).__tauriCalls__ as { cmd: string; args: any }[]
    );
    const call = [...calls].reverse().find((c) => c.cmd === "get_blank_rows");
    expect(call).toBeDefined();
    expect(call!.args.path).toBe(FAKE_PATH);
    expect(call!.args.headerRow).toBe(0);
  });
});

// ─── Confirm dialog (header change with active skip rows) ────────────────────

test.describe("confirm clear skip rows dialog", () => {
  async function applySkipRowsThenChangeHeader(page: Page) {
    await skipRowsInput(page).fill("2");
    await skipRowsInput(page).press("Tab");
    await expect(page.getByText("1 row hidden")).toBeVisible();
    await headerRowInput(page).fill("2");
    await headerRowInput(page).press("Tab");
  }

  test("dialog appears when changing header row while skip rows are active", async ({ page }) => {
    await setup(page);
    await applySkipRowsThenChangeHeader(page);
    await expect(page.getByRole("alertdialog")).toBeVisible();
  });

  test("Cancel keeps original header row and skip rows intact", async ({ page }) => {
    await setup(page);
    await applySkipRowsThenChangeHeader(page);
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("alertdialog")).not.toBeVisible();
    await expect(page.getByText("1 row hidden")).toBeVisible();
    await expect(headerRowInput(page)).toHaveValue("2");
  });

  test("Continue clears skip rows and applies new header row", async ({ page }) => {
    await setup(page);
    await applySkipRowsThenChangeHeader(page);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("alertdialog")).not.toBeVisible();
    await expect(page.getByText(/rows? hidden/)).not.toBeAttached();

    const calls = await page.evaluate(
      () => (window as any).__tauriCalls__ as { cmd: string; args: any }[]
    );
    const last = [...calls]
      .reverse()
      .find((c) => c.cmd === "get_sheet_rows_paged_filtered");
    expect(last!.args.headerRow).toBe(1);
    expect(last!.args.skipRows).toEqual([]);
  });

  test("dialog does not appear when changing only skip rows (no header change)", async ({ page }) => {
    await setup(page);
    await skipRowsInput(page).fill("2");
    await skipRowsInput(page).press("Tab");
    await skipRowsInput(page).fill("3");
    await skipRowsInput(page).press("Tab");

    await expect(page.getByRole("alertdialog")).not.toBeAttached();
  });
});

// ─── Tab / sheet switch resets filters ───────────────────────────────────────

test.describe("sheet switch resets filters", () => {
  async function setupTwoSheets(page: Page) {
    await mockTauriIpc(page, {
      selectedFile: FAKE_PATH,
      sheetRows: FAKE_ROWS,
      sheetNames: ["Alpha", "Beta"],
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Select Excel File" }).click();
    await expect(page.locator("#header-row")).toBeVisible();
  }

  async function switchToSheet(page: Page, name: string) {
    // The tab trigger contains a nested Select.Trigger with stopPropagation.
    // Click in the left-padding zone (x=4) where no child element exists,
    // so the click reaches the Tabs.Trigger handler and fires onValueChange.
    await page.getByRole("tab").filter({ hasText: name }).click({ position: { x: 4, y: 12 } });
  }

  test("header row resets to 1 when switching sheets", async ({ page }) => {
    await setupTwoSheets(page);
    await headerRowInput(page).fill("2");
    await headerRowInput(page).press("Tab");
    await switchToSheet(page, "Beta");
    await expect(headerRowInput(page)).toHaveValue("1");
  });

  test("skip rows input clears when switching sheets", async ({ page }) => {
    await setupTwoSheets(page);
    await skipRowsInput(page).fill("2");
    await skipRowsInput(page).press("Tab");
    await switchToSheet(page, "Beta");
    await expect(skipRowsInput(page)).toHaveValue("");
  });

  test("hidden row count is gone after switching sheets", async ({ page }) => {
    await setupTwoSheets(page);
    await skipRowsInput(page).fill("2");
    await skipRowsInput(page).press("Tab");
    await expect(page.getByText("1 row hidden")).toBeVisible();
    await switchToSheet(page, "Beta");
    await expect(page.getByText(/rows? hidden/)).not.toBeAttached();
  });
});
