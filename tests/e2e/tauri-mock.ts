import { type Page } from "@playwright/test";

export type MockConfig = {
  pgConnectFails?: boolean;
  pgConnectDelay?: number;
  /** Path returned by the file-open dialog. Omit or set null to simulate cancel. */
  selectedFile?: string | null;
  /** Rows returned by get_sheet_rows_paged_filtered. Row 0 is the header row. */
  sheetRows?: string[][];
};

export async function mockTauriIpc(page: Page, config: MockConfig = {}) {
  // Config is serialised as JSON by Playwright — only primitives allowed, no functions.
  await page.addInitScript((cfg) => {
    (window as any).__TAURI_INTERNALS__ = {
      invoke: (cmd: string) => {
        switch (cmd) {
          case "clear_cache":
          case "get_blank_rows":
          case "infer_column_types":
            return Promise.resolve(null);

          case "get_sheets":
            return Promise.resolve(["Sheet1", "Sheet2"]);

          case "get_sheet_rows_paged":
          case "get_sheet_rows_paged_filtered":
            return Promise.resolve({
              rows: cfg.sheetRows ?? [],
              total_rows: Math.max(0, (cfg.sheetRows?.length ?? 1) - 1),
            });

          case "pg_get_tables":
            return Promise.resolve([]);

          case "plugin:dialog|open":
            return Promise.resolve(cfg.selectedFile ?? null);

          case "pg_connect":
            if (cfg.pgConnectFails) {
              return Promise.reject("Connection refused to 127.0.0.1:9999");
            }
            if (cfg.pgConnectDelay) {
              return new Promise((r) =>
                setTimeout(() => r(null), cfg.pgConnectDelay)
              );
            }
            return Promise.resolve(null);

          default:
            return Promise.reject(`Unhandled Tauri command: ${cmd}`);
        }
      },
      transformCallback: (cb: unknown) => cb,
      metadata: {},
    };
  }, config);
}
