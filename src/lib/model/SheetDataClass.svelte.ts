import { invoke } from "@tauri-apps/api/core";
import { AsyncResource } from "./AsyncResource.svelte";
import type { SheetClass } from "./SheetClass.svelte";

const PAGE_SIZE = 10;
export type InsertStatus =
  | { success: true; count: number }
  | { success: false; error: string };

export class SheetDataClass extends AsyncResource {
  sheet: SheetClass;
  constructor(sheet: SheetClass) {
    super();
    this.sheet = sheet;
  }

  rows: string[][] = $state.raw([]);
  currentPage: number = $state(0);
  pageSize: number = $state(PAGE_SIZE);
  totalRows: number | undefined = $state(undefined);
  totalPages = $derived(
    this.totalRows ? Math.ceil(this.totalRows / this.pageSize) : undefined,
  );

  async loadPage(page: number) {
    this.load(async () => {
      this._loadPage(page);
    });
  }

  private async _loadPage(page: number) {
    if (page < 0 || page >= (this.totalPages ?? 1)) return;
    this.currentPage = page;

    const result = await invoke<{ rows: string[][]; total_rows: number }>(
      "get_sheet_rows_paged_filtered",
      {
        path: this.sheet.workbook.filePath,
        sheet: this.sheet.name,
        page,
        pageSize: PAGE_SIZE,
        headerRow: this.sheet.headerRow,
        skipRows: this.sheet.skipRows,
      },
    );
    this.rows = result.rows;
    this.totalRows = result.total_rows;
  }

  public async skipBlankRows() {
    const filePath = this.sheet.workbook.filePath;
    if (!filePath) return;
    const blank = await invoke<number[]>("get_blank_rows", {
      path: filePath,
      sheet: this.sheet.name,
      headerRow: this.sheet.headerRow,
    });
    if (blank.length === 0) return;
    const merged = new Set([...this.sheet.skipRows, ...blank]);
    this.sheet.skipRows = Array.from(merged).sort((a, b) => a - b);
  }
}
