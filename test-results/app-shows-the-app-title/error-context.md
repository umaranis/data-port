# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> shows the app title
- Location: tests/e2e/app.spec.ts:9:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Data Port' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Data Port' })

```

# Page snapshot

```yaml
- main [ref=e3]:
  - heading "Data-Port" [level=1] [ref=e4]
  - generic [ref=e5]:
    - button "Select Excel File" [ref=e7]
    - button "Clear cache" [ref=e8]
  - button "Connect to Postgres" [ref=e10]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { mockTauriIpc } from "./tauri-mock";
  3  | 
  4  | test.beforeEach(async ({ page }) => {
  5  |   await mockTauriIpc(page);
  6  |   await page.goto("/");
  7  | });
  8  | 
  9  | test("shows the app title", async ({ page }) => {
> 10 |   await expect(page.getByRole("heading", { name: "Data Port" })).toBeVisible();
     |                                                                  ^ Error: expect(locator).toBeVisible() failed
  11 | });
  12 | 
  13 | test("shows the Select Excel File button", async ({ page }) => {
  14 |   await expect(page.getByRole("button", { name: "Select Excel File" })).toBeVisible();
  15 | });
  16 | 
  17 | test("shows the Clear cache button", async ({ page }) => {
  18 |   await expect(page.getByRole("button", { name: "Clear cache" })).toBeVisible();
  19 | });
  20 | 
  21 | test("shows the Connect to Postgres button", async ({ page }) => {
  22 |   await expect(page.getByRole("button", { name: "Connect to Postgres" })).toBeVisible();
  23 | });
  24 | 
  25 | test("no sheet tabs visible before a file is loaded", async ({ page }) => {
  26 |   await expect(page.getByRole("tab")).toHaveCount(0);
  27 | });
  28 | 
  29 | test("Clear cache button shows feedback then reverts", async ({ page }) => {
  30 |   // Use a locator that can find the button regardless of its current text
  31 |   const btn = page.locator("button", { hasText: /Clear cache|Cache cleared/ }).first();
  32 |   await btn.click();
  33 |   await expect(page.getByRole("button", { name: "Cache cleared" })).toBeVisible({ timeout: 2000 });
  34 |   await expect(page.getByRole("button", { name: "Clear cache" })).toBeVisible({ timeout: 4000 });
  35 | });
  36 | 
```