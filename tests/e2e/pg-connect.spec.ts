import { test, expect, type Page } from "@playwright/test";
import { mockTauriIpc, type MockConfig } from "./tauri-mock";

async function setupAndOpenDialog(page: Page, config: MockConfig = {}) {
  await mockTauriIpc(page, config);
  await page.goto("/");
  await page.getByRole("button", { name: "Connect to Postgres" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

const connectBtn = (page: Page) =>
  page.getByRole("dialog").getByRole("button", { name: "Connect", exact: true });

test.beforeEach(async ({ page }) => {
  await setupAndOpenDialog(page);
});

test("dialog has correct heading", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "PostgreSQL Connection" })).toBeVisible();
});

test("host field defaults to localhost", async ({ page }) => {
  await expect(page.locator("#pg-host")).toHaveValue("localhost");
});

test("port field defaults to 5432", async ({ page }) => {
  await expect(page.locator("#pg-port")).toHaveValue("5432");
});

test("database, username and password fields start empty", async ({ page }) => {
  await expect(page.locator("#pg-database")).toHaveValue("");
  await expect(page.locator("#pg-username")).toHaveValue("");
  await expect(page.locator("#pg-password")).toHaveValue("");
});

test("connection string updates live as fields change", async ({ page }) => {
  const code = page.getByRole("dialog").locator("code");
  await expect(code).toContainText("postgresql://");
  await expect(code).toContainText("localhost:5432");

  await page.locator("#pg-database").fill("mydb");
  await expect(code).toContainText("mydb");
});

test("connection string includes credentials when entered", async ({ page }) => {
  await page.locator("#pg-username").fill("admin");
  await page.locator("#pg-password").fill("secret");
  await page.locator("#pg-database").fill("mydb");

  const code = page.getByRole("dialog").locator("code");
  await expect(code).toContainText("admin");
  await expect(code).toContainText("mydb");
});

test("Cancel closes the dialog", async ({ page }) => {
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("shows success and auto-closes on successful connection", async ({ page }) => {
  await page.locator("#pg-database").fill("mydb");
  await connectBtn(page).click();
  await expect(page.locator("dialog p").filter({ hasText: "Connected successfully" })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3000 });
});

test("shows error when connection is rejected", async ({ page }) => {
  await setupAndOpenDialog(page, { pgConnectFails: true });
  await page.locator("#pg-database").fill("test");
  await connectBtn(page).click();
  await expect(
    page.locator("dialog p").filter({ hasText: "Connection refused" })
  ).toBeVisible({ timeout: 5000 });
});

test("Connect button is disabled during a pending request", async ({ page }) => {
  await setupAndOpenDialog(page, { pgConnectDelay: 800 });
  await page.locator("#pg-database").fill("test");
  // Submit button text changes to "Connecting…" while in-flight; check by type instead
  const submitBtn = page.getByRole("dialog").locator("button[type='submit']");
  await connectBtn(page).click();
  await expect(submitBtn).toBeDisabled();
});
