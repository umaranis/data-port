import { invoke } from "@tauri-apps/api/core";
import type { WorkbookClass } from "./WorkbookClass.svelte";
import { convertToDBFriendlyName, type DbColumn } from "$lib/model/pgTypes";
import { type SheetColumn } from "./SheetColumnClass.svelte";
import { SheetDataClass } from "./SheetDataClass.svelte";
import type { ProjectSheet } from "./projectTypes";

export type SheetAction = "create" | "append" | "recreate" | "skip";

export class SheetClass {
  public name: string;
  private _workbook: WorkbookClass;
  public get workbook(): WorkbookClass {
    return this._workbook;
  }
  private _tableName: string | null;
  public get tableName() {
    return this._tableName;
  }
  public set tableName(value) {
    this._tableName = value;
  }

  private _data = new SheetDataClass(this);
  public get data(): SheetDataClass {
    return this._data;
  }

  constructor(name: string, workbook: WorkbookClass) {
    this.name = name;
    this._workbook = workbook;
    this._tableName = $state(convertToDBFriendlyName(name));
  }

  private _loaded: boolean = $state(false);
  public get loaded(): boolean {
    return this._loaded;
  }

  private _action: SheetAction = $state("create");
  public get action(): SheetAction {
    return this._action;
  }
  public async setAction(value: SheetAction) {
    this._action = value;
    if (value === "append") {
      await this.setActionAppend();
    } else {
      this.tableName = this.tableName || convertToDBFriendlyName(this.name);
      this.dbColumns = null;
    }
  }
  private async setActionAppend() {
    this._action = "append";
    const match = this.workbook.database.tables.find(
      (t) => t === this.tableName || t.split(".").pop() === this.tableName,
    );
    this.tableName = match ?? null;
    await this.reMatchColumnsWithDB();
  }

  private async reMatchColumnsWithDB() {
    if (this.tableName) {
      const dbCols = await this.workbook.database.loadDbColumns(this.tableName);

      this.dbColumns = dbCols;
      this._columns = this._columns.map((col) => {
        if (!col.dbColName) return col;
        const matchingDbCol = dbCols.find(
          (dbCol) => dbCol.dbColName === col.dbColName,
        );
        if (matchingDbCol) {
          return {
            ...col,
            dataType: matchingDbCol.dataType,
            length: matchingDbCol.length,
            precision: matchingDbCol.precision,
            scale: matchingDbCol.scale,
          };
        }
        return { ...col, dbColName: undefined };
      });
    }
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

  private _columns: Readonly<SheetColumn>[] = $state([]);
  // columns from the sheet appear first
  public get columns(): ReadonlyArray<Readonly<SheetColumn>> {
    return this._columns;
  }
  private setColumns(headers: string[]) {
    this._columns = headers.map((h) => ({
      type: "sheet",
      header: h,
      dataType: "text",
      dbColName: convertToDBFriendlyName(h),
      excluded: false,
    }));
  }

  // null if sheet action is 'create', may or may not be null if 'append'
  // if not null, then sheet column name must match with dbColumns or column name is undefined
  private dbColumns: ReadonlyArray<Readonly<DbColumn>> | null = null;

  public async applySnapshot(s: ProjectSheet) {
    this._action = s.action;
    this.tableName = s.tableName;
    this._headerRow = s.headerRow;
    this._skipRows = s.skipRows;
    await this.loadSheet();
    this._columns = this._columns.map((col) => {
      const saved = s.columns.find(
        (sc) =>
          sc.type === "sheet" &&
          col.type === "sheet" &&
          sc.header === col.header,
      );
      return saved ? { ...col, ...saved } : col;
    });
    // load additional columns
    s.columns.forEach((col) => {
      if (col.type !== "sheet") {
        this._columns.push(col);
      }
    });
  }

  public async loadSheet() {
    this._loaded = false;
    const headers = await invoke<string[]>("get_sheet_header", {
      path: this.workbook.filePath,
      sheet: this.name,
      headerRow: this.headerRow,
    });

    this.setColumns(headers);

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

    types.forEach((type, index) => {
      if (index < this._columns.length) {
        const col = this._columns[index];
        if (col.type === "sheet") {
          this._columns[index] = {
            ...col,
            dataType: type.dataType,
            length: type.length,
            precision: type.precision,
            scale: type.scale,
          };
        }
      }
    });
  }
}
