# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Data Port is a **Tauri 2 desktop app** for importing spreadsheet (Excel/xlsx) data into a **PostgreSQL or DB2** database. The frontend is **SvelteKit + Svelte 5 (runes)**; the backend is **Rust**. The two halves communicate exclusively through Tauri commands (`invoke()` on the JS side, `#[tauri::command]` on the Rust side).

## Commands

Use `pnpm` (there is a `pnpm-lock.yaml`).

- `pnpm tauri dev` — run the full desktop app (starts Vite on port 1420, then the Tauri shell). This is the real way to run the app; `pnpm dev` alone only serves the frontend in a browser without the Rust backend.
- `pnpm tauri build` — production build.
- `pnpm check` — Svelte + TypeScript type checking (`svelte-check`).
- `pnpm lint` / `pnpm lint:fix` — ESLint over `src`.
- `pnpm format` — Prettier over `src`.
- `pnpm test:unit` — Vitest (frontend unit tests, `src/**/*.test.ts`). Run a single file: `pnpm test:unit src/lib/SkipRows.test.ts`.
- `pnpm test:e2e` — Playwright e2e (uses `tauri-mock.ts` to mock the Rust backend; runs against the Vite dev server, not the real app).
- Rust tests: `cd src-tauri && cargo test`. Tests live in colocated `*_tests.rs` files (e.g. `db_tests.rs`, `infer_tests.rs`) wired in via `#[path = "..."] mod tests;`.

DB2 support requires unixODBC and the IBM DB2 CLI driver installed on the machine — see [db2-setup.md](db2-setup.md). Without them the DB2 features and the `odbc-api` build will fail.

## Rust backend (`src-tauri/src`)

`lib.rs` is the entry point: it defines the spreadsheet-reading commands, owns the `SheetCache`, and registers **all** commands in `invoke_handler`. When adding a command anywhere, it must be added to that `generate_handler!` list.

- **`lib.rs`** — spreadsheet reading via `calamine`. `SheetCache` (a `Mutex<HashMap<(path, sheet), Arc<Range>>>`, managed Tauri state) caches whole sheet ranges because calamine has no streaming API. It has **no eviction**; the frontend calls `clear_cache` on every file selection/project load, so always clear it when the active file changes. Rows are paged/filtered server-side (`get_sheet_rows_paged`, `..._filtered`, `get_blank_rows`).
- **`infer.rs`** — infers DB column types from sampled cell data.
- **`db.rs`** — PostgreSQL via `tokio-postgres`. Inserts run in a transaction with typed placeholders (`$n::type`); empty non-text values become NULL.
- **`db2.rs`** — DB2 via `odbc-api`. Mirrors `db.rs`'s command surface (`db2_connect`, `db2_get_tables`, `db2_get_columns`, `db2_execute`, `db2_insert_rows`).
- **`project.rs`** — save/load projects to `app_data_dir/projects` as JSON. **Passwords are stripped from connection strings and stored in the OS keychain** (`keyring`, service `data-port`); the JSON never contains the password. `strip_password`/`inject_password` handle PG URLs, `strip_odbc_password`/`inject_odbc_password` handle DB2 ODBC DSN strings.

## Frontend architecture (`src/lib`)

State is modeled as **reactive classes in `.svelte.ts` files** using Svelte 5 runes (`$state`, `$derived`) as private fields behind getters/setters. This is the core pattern — understand it before editing model code.

- **`model/DatabaseClass.svelte.ts`** — the DB connection. Holds `dbType` (`"postgres" | "db2"`), the connection string, and the table/column lists. Setting `connectionString` triggers loading tables. Created once in `routes/+page.svelte` and shared everywhere via **`databaseContext`** (`getDatabaseContext`/`setDatabaseContext`) — do not instantiate a second one.
- **`model/WorkbookClass.svelte.ts`** — one loaded spreadsheet file. `WorkbookClass.create(path, db)` reads sheet names and builds `SheetClass[]`. Lazy-loads a sheet's data when it becomes `selectedSheet`.
- **`model/SheetClass.svelte.ts`** — one sheet: its target `tableName`, `action`, header row, skip rows, column data (`SheetDataClass`), and column-to-DB `mappings` (`SheetMappingClass`). Changing `tableName` re-derives DB column names and re-matches against the DB schema.
- **`model/AsyncResource.svelte.ts`** — base class giving `loading`/`error` state and a `load()` helper; `WorkbookClass` and `DatabaseClass` extend it. Use it for anything doing async `invoke` work.
- **`model/projectTypes.ts`** — the serialized `Project`/`ProjectSheet` shapes. Model classes expose `toSnapshot()`/`deserialize()` to convert to/from these when saving/loading projects.

`routes/+page.svelte` is the top-level composition root (wires file selection, DB connect, project save/load, and the `Workbook` view). `src/lib/components/ui/**` is generated **shadcn-svelte** (bits-ui + Tailwind v4); treat it as vendored — prefer adding via the shadcn CLI over hand-editing.

## Conventions

- Two-space indent in `.svelte`/`.ts` (see existing files); tabs appear only in some config files.
- Reactive model logic goes in `.svelte.ts` classes with private `$state` fields and public getters/setters, not in components.
- `src-tauri/**` is excluded from ESLint; lint/format apply to `src` only.

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, label strings unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
