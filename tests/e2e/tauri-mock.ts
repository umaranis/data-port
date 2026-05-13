import { type Page } from "@playwright/test";

export type MockConfig = {
  pgConnectFails?: boolean;
  pgConnectDelay?: number;
  /** Path returned by the file-open dialog. Omit or set null to simulate cancel. */
  selectedFile?: string | null;
  /** Rows returned by get_sheet_rows_paged_filtered. Row 0 is the header row. */
  sheetRows?: string[][];
  /** Sheet names returned by get_sheets. Defaults to ["Sheet1", "Sheet2"]. */
  sheetNames?: string[];
  /** Tables returned by pg_get_tables. */
  dbTables?: string[];
  /** Row count returned by pg_insert_rows. */
  insertedRows?: number;
  /** Columns returned by pg_get_columns. */
  dbColumns?: { dbColName: string; dataType: string }[];
  /** Per-table columns returned by pg_get_columns. Takes precedence over dbColumns. */
  dbColumnsByTable?: Record<string, { dbColName: string; dataType: string }[]>;
  /** Row indices returned by get_blank_rows. */
  blankRows?: number[];
  /** Project names returned by list_projects. */
  savedProjects?: string[];
  /** Project object returned by load_project. */
  savedProject?: object;
};

export async function mockTauriIpc(page: Page, config: MockConfig = {}) {
  // Config is serialised as JSON by Playwright — only primitives allowed, no functions.
  await page.addInitScript((cfg) => {
    (window as any).__tauriCalls__ = [] as { cmd: string; args: unknown }[];
    (window as any).__TAURI_INTERNALS__ = {
      invoke: (cmd: string, args?: unknown) => {
        (window as any).__tauriCalls__.push({ cmd, args });
        switch (cmd) {
          case "clear_cache":
          case "infer_column_types":
            return Promise.resolve(null);

          case "get_blank_rows":
            return Promise.resolve(cfg.blankRows ?? []);

          case "get_sheets":
            return Promise.resolve(cfg.sheetNames ?? ["Sheet1", "Sheet2"]);

          case "get_sheet_header": {
            const hr: number = (args as any)?.headerRow ?? 0;
            return Promise.resolve(cfg.sheetRows?.[hr] ?? []);
          }

          case "get_sheet_rows_paged":
          case "get_sheet_rows_paged_filtered":
            return Promise.resolve({
              rows: cfg.sheetRows?.slice(1) ?? [],
              total_rows: Math.max(0, (cfg.sheetRows?.length ?? 1) - 1),
            });

          case "pg_get_tables":
            return Promise.resolve(cfg.dbTables ?? []);

          case "pg_insert_rows":
            return Promise.resolve(cfg.insertedRows ?? 0);

          case "pg_get_columns": {
            const tbl: string = (args as any)?.tableName ?? "";
            if (cfg.dbColumnsByTable) {
              return Promise.resolve(cfg.dbColumnsByTable[tbl] ?? []);
            }
            return Promise.resolve(cfg.dbColumns ?? []);
          }

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

          case "list_projects":
            return Promise.resolve(cfg.savedProjects ?? []);

          case "save_project":
            return Promise.resolve(null);

          case "load_project":
            return cfg.savedProject
              ? Promise.resolve(cfg.savedProject)
              : Promise.reject("not found");

          default:
            return Promise.reject(`Unhandled Tauri command: ${cmd}`);
        }
      },
      transformCallback: (cb: unknown) => cb,
      metadata: {},
    };
  }, config);
}
