import { invoke } from "@tauri-apps/api/core";
import type { WorkbookClass } from "./WorkbookClass.svelte";
import { type DbColumn, type PgType } from "$lib/model/pgTypes";
import { type SheetColumn } from "./SheetColumnClass.svelte";
import { SheetDataClass } from "./SheetDataClass.svelte";
import type { ProjectSheet } from "./projectTypes";
import { SheetMappingClass } from "./SheetMappingClass.svelte";

/** One tab of a workbook, treated purely as a data source. Owns the header row,
 * skipped rows, its raw Sheet Columns, and paged data, plus one or more Mappings
 * describing how it loads into the database. */
export class SheetClass {
  public name: string;
  private _workbook: WorkbookClass;
  public get workbook(): WorkbookClass {
    return this._workbook;
  }

  private _data = new SheetDataClass(this);
  public get data(): SheetDataClass {
    return this._data;
  }

  private _mappings: SheetMappingClass[] = $state([]);
  public get mappings(): ReadonlyArray<SheetMappingClass> {
    return this._mappings;
  }

  private _selectedMappingIndex: number = $state(0);
  public get selectedMappingIndex(): number {
    return this._selectedMappingIndex;
  }
  public set selectedMappingIndex(value: number) {
    this._selectedMappingIndex = value;
  }
  public get selectedMapping(): SheetMappingClass {
    return this._mappings[this._selectedMappingIndex] ?? this._mappings[0];
  }

  /** A skipped Sheet is excluded from loading entirely; its Mappings are ignored. */
  private _skipped: boolean = $state(false);
  public get skipped(): boolean {
    return this._skipped;
  }
  public set skipped(value: boolean) {
    this._skipped = value;
  }

  constructor(name: string, workbook: WorkbookClass) {
    this.name = name;
    this._workbook = workbook;
    this._mappings = [new SheetMappingClass(this, workbook.database)];
  }

  private _loaded: boolean = $state(false);
  public get loaded(): boolean {
    return this._loaded;
  }

  private _headerRow: number = $state(0);
  /**  0 indexed */
  public get headerRow(): number {
    return this._headerRow;
  }
  /** Clears `skipRows` since row numbers will change */
  public setHeaderRow(value: number) {
    this._headerRow = value;
    this._skipRows = [];
    this.loadSheet();
  }

  private _skipRows: number[] = $state([]);
  public get skipRows(): number[] {
    return this._skipRows;
  }
  public set skipRows(value: number[]) {
    this._skipRows = value;
    this.data.loadPage(0);
  }

  private _columns: SheetColumn[] = $state([]);
  public get columns(): ReadonlyArray<SheetColumn> {
    return this._columns;
  }
  private setColumns(headers: string[]) {
    this._columns = headers.map((h) => ({
      header: h,
      dataType: "text" as PgType,
    }));
  }

  public async loadSheet(reseed: boolean = true) {
    this._loaded = false;
    const headers = await invoke<string[]>("get_sheet_header", {
      path: this.workbook.filePath,
      sheet: this.name,
      headerRow: this.headerRow,
    });

    this.setColumns(headers);
    if (reseed) {
      for (const m of this._mappings) m.onSheetColumnsChanged();
    }

    this.data.loadPage(0);

    this._loaded = true;
  }

  public async inferColumnTypes() {
    const types = await invoke<DbColumn[]>("infer_column_types", {
      path: this.workbook.filePath,
      sheet: this.name,
      headerRow: this.headerRow,
      skipRows: this.skipRows,
    });

    // Update the raw source columns' suggested types, so future seeds carry them…
    this._columns = this._columns.map((col, i) => {
      const t = types[i];
      return t
        ? {
            ...col,
            dataType: t.dataType,
            length: t.length,
            precision: t.precision,
            scale: t.scale,
          }
        : col;
    });
    // …and apply to the currently selected create/recreate mapping's targets.
    this.selectedMapping?.applyInferredTypes(types);
  }

  public toSnapshot(): ProjectSheet {
    return {
      name: this.name,
      skipped: this._skipped,
      headerRow: this._headerRow,
      skipRows: this._skipRows,
      mappings: this._mappings.map((m) => m.toSnapshot()),
    };
  }

  public async applySnapshot(s: ProjectSheet) {
    this._skipped = s.skipped;
    this._headerRow = s.headerRow;
    this._skipRows = s.skipRows;
    await this.loadSheet(false);
    if (s.mappings.length > 0) {
      this._mappings = s.mappings.map((pm) => {
        const m = new SheetMappingClass(this, this.workbook.database);
        m.deserialize(pm);
        return m;
      });
      this._selectedMappingIndex = 0;
    }
  }
}
