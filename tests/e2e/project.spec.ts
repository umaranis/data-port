import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc } from "./tauri-mock";

const FAKE_PATH = "/fake/data.xlsx";
const SHEET_NAME = "Sheet1";
const FAKE_ROWS = [
  ["id", "name"],
  ["1", "Alice"],
];

const FAKE_PROJECT = {
  name: "my-project",
  filePath: FAKE_PATH,
  connectionString: "postgresql://localhost/testdb",
  sheets: [
    {
      name: SHEET_NAME,
      skipped: false,
      headerRow: 0,
      skipRows: [],
      mappings: [
        {
          action: "create",
          tableName: "sheet1",
          columns: [
            {
              target: { dbColName: "id", dataType: "text" },
              source: { kind: "sheet", sheetColIndex: 0 },
            },
            {
              target: { dbColName: "name", dataType: "text" },
              source: { kind: "sheet", sheetColIndex: 1 },
            },
          ],
        },
      ],
    },
  ],
};

async function loadFile(page: Page) {
  await page.getByRole("button", { name: "Select Excel File" }).click();
  await expect(page.getByRole("tab", { name: SHEET_NAME })).toBeVisible();
}

async function getLastCall(page: Page, cmd: string) {
  return page.evaluate((c) => {
    const calls = (window as any).__tauriCalls__ as { cmd: string; args: any }[];
    return [...calls].reverse().find((x) => x.cmd === c)?.args;
  }, cmd);
}

test.describe("save project", () => {
  test("Save button not visible before file load", async ({ page }) => {
    await mockTauriIpc(page, {});
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Save project" }),
    ).not.toBeVisible();
  });

  test("Save button visible after file load", async ({ page }) => {
    await mockTauriIpc(page, {
      selectedFile: FAKE_PATH,
      sheetRows: FAKE_ROWS,
      sheetNames: [SHEET_NAME],
    });
    await page.goto("/");
    await loadFile(page);
    await expect(
      page.getByRole("button", { name: "Save project" }),
    ).toBeVisible();
  });

  test.describe("save dialog", () => {
    test.beforeEach(async ({ page }) => {
      await mockTauriIpc(page, {
        selectedFile: FAKE_PATH,
        sheetRows: FAKE_ROWS,
        sheetNames: [SHEET_NAME],
      });
      await page.goto("/");
      await loadFile(page);
    });

    test("opens when Save project button clicked", async ({ page }) => {
      await page.getByRole("button", { name: "Save project" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
    });

    test("shows error when name is blank", async ({ page }) => {
      await page.getByRole("button", { name: "Save project" }).click();
      await page.getByPlaceholder("Project name").clear();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(
        page.getByText("Project name is required."),
      ).toBeVisible();
    });

    test("Cancel closes dialog without saving", async ({ page }) => {
      await page.getByRole("button", { name: "Save project" }).click();
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("alertdialog")).not.toBeVisible({
        timeout: 3000,
      });
      const call = await getLastCall(page, "save_project");
      expect(call).toBeUndefined();
    });

    test("Enter key triggers save and sets project name in title", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Save project" }).click();
      await page.getByPlaceholder("Project name").fill("my-project");
      await page.getByPlaceholder("Project name").press("Enter");
      await expect(page.getByText("— my-project")).toBeVisible();
    });

    test("Save button saves and closes dialog", async ({ page }) => {
      await page.getByRole("button", { name: "Save project" }).click();
      await page.getByPlaceholder("Project name").fill("my-project");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("alertdialog")).not.toBeVisible({
        timeout: 3000,
      });
    });

    test("save_project called with correct name", async ({ page }) => {
      await page.getByRole("button", { name: "Save project" }).click();
      await page.getByPlaceholder("Project name").fill("my-project");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("alertdialog")).not.toBeVisible({
        timeout: 3000,
      });
      const call = await getLastCall(page, "save_project");
      expect(call).toBeDefined();
      expect(call.name).toBe("my-project");
    });

    test("save_project payload contains filePath", async ({ page }) => {
      await page.getByRole("button", { name: "Save project" }).click();
      await page.getByPlaceholder("Project name").fill("my-project");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("alertdialog")).not.toBeVisible({
        timeout: 3000,
      });
      const call = await getLastCall(page, "save_project");
      expect(call.payload.filePath).toBe(FAKE_PATH);
    });

    test("project name appears in title after save", async ({ page }) => {
      await page.getByRole("button", { name: "Save project" }).click();
      await page.getByPlaceholder("Project name").fill("my-project");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText("— my-project")).toBeVisible();
    });
  });
});

test.describe("load project", () => {
  test("Load dropdown not visible when no saved projects", async ({ page }) => {
    await mockTauriIpc(page, { savedProjects: [] });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Load project" }),
    ).not.toBeVisible();
  });

  test("Load dropdown visible when projects exist", async ({ page }) => {
    await mockTauriIpc(page, { savedProjects: ["my-project"] });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Load project" }),
    ).toBeVisible();
  });

  test.describe("loading a project", () => {
    test.beforeEach(async ({ page }) => {
      await mockTauriIpc(page, {
        sheetRows: FAKE_ROWS,
        sheetNames: [SHEET_NAME],
        savedProjects: ["my-project"],
        savedProject: FAKE_PROJECT,
      });
      await page.goto("/");
    });

    test("sets project name in title", async ({ page }) => {
      await page.getByRole("button", { name: "Load project" }).click();
      await page.getByRole("option", { name: "my-project" }).click();
      await expect(page.getByText("— my-project")).toBeVisible();
    });

    test("shows workbook sheet tab", async ({ page }) => {
      await page.getByRole("button", { name: "Load project" }).click();
      await page.getByRole("option", { name: "my-project" }).click();
      await expect(page.getByRole("tab", { name: SHEET_NAME })).toBeVisible();
    });

    test("shows Save project button", async ({ page }) => {
      await page.getByRole("button", { name: "Load project" }).click();
      await page.getByRole("option", { name: "my-project" }).click();
      await expect(
        page.getByRole("button", { name: "Save project" }),
      ).toBeVisible();
    });

    test("load_project called with correct name", async ({ page }) => {
      await page.getByRole("button", { name: "Load project" }).click();
      await page.getByRole("option", { name: "my-project" }).click();
      await expect(page.getByText("— my-project")).toBeVisible();
      const call = await getLastCall(page, "load_project");
      expect(call).toBeDefined();
      expect(call.name).toBe("my-project");
    });
  });
});
