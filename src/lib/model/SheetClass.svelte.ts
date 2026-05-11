import { invoke } from "@tauri-apps/api/core";
import type { WorkbookClass } from "./WorkbookClass.svelte";
import { convertToDBFriendlyName, type ColumnMeta } from "$lib/model/pgTypes";
import { type SheetColumn } from "./SheetColumnClass.svelte";
import { SheetDataClass } from "./SheetDataClass.svelte";
import type { DatabaseClass } from "./DatabaseClass.svelte";
import type { ProjectSheet } from "./projectTypes";

export type SheetAction = "create" | "append" | "recreate" | "skip";

export class SheetClass {
  public name: string;
  private _workbook: WorkbookClass;
  public get workbook(): WorkbookClass {
    return this._workbook;
  }
  public tableName: string | null;

  private _data = new SheetDataClass(this);
  public get data(): SheetDataClass {
    return this._data;
  }

  constructor(name: string, workbook: WorkbookClass) {
    this.name = name;
    this._workbook = workbook;
    this.tableName = $state(convertToDBFriendlyName(name));
  }

  private _loaded: boolean = $state(false);
  public get loaded(): boolean {
    return this._loaded;
  }

  private _action: SheetAction = $state("create");
  public get action(): SheetAction {
    return this._action;
  }
  public async setAction(
    value:
      | { action: "create" | "recreate" | "skip" }
      | { action: "append"; db: DatabaseClass },
  ) {
    this._action = value.action;
    if (value.action === "append") {
      await this.setActionAppend(value.db);
    } else {
      this.tableName = this.tableName || convertToDBFriendlyName(this.name);
      this.dbColumns = null;
    }
  }
  private async setActionAppend(db: DatabaseClass) {
    this._action = "append";
    const match = db.tables.find(
      (t) => t === this.tableName || t.split(".").pop() === this.tableName,
    );
    this.tableName = match ?? null;
    if (this.tableName) {
      const dbCols = await db.loadDbColumns(this.tableName);

      this.dbColumns = dbCols;
      this.columns.forEach((col, index) => {
        if (col.dbColumn.name) {
          const matchingDbCol = dbCols.find((dbCol) => {
            return dbCol.name == col.dbColumn.name;
          });
          if (matchingDbCol) {
            col.dbColumn.type = matchingDbCol.type;
            col.dbColumn.length = matchingDbCol.length;
            col.dbColumn.precision = matchingDbCol.precision;
            col.dbColumn.scale = matchingDbCol.scale;
          } else {
            col.dbColumn.name = undefined;
          }
        }
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

  // start: columns list

  private _columns: Readonly<SheetColumn>[] = $state([]);
  // columns from the sheet appear first
  public get columns(): ReadonlyArray<Readonly<SheetColumn>> {
    return this._columns;
  }
  private setColumns(headers: string[]) {
    this._columns = headers.map((h) => ({
      type: "sheet",
      header: h,
      dbColumn: {
        type: "text",
        name: convertToDBFriendlyName(h),
      },
      excluded: false,
    }));
  }

  // null if sheet action is 'create', may or may not be null if 'append'
  // if not null, then sheet dbColumn must match with dbColumns or dbColumn.name is null
  private dbColumns: ReadonlyArray<Readonly<ColumnMeta>> | null = null;

  //end: columns list

  public applySnapshot(s: ProjectSheet) {
    this._action = s.action;
    this.tableName = s.tableName;
    this._headerRow = s.headerRow;
    this._skipRows = s.skipRows;
    this._columns = s.columns as Readonly<SheetColumn>[];
  }

  public async loadSheet() {
    this._loaded = false;
    console.log("[SheetClass] get_sheet_header", {
      path: this.workbook.filePath,
      sheet: this.name,
      headerRow: this.headerRow,
    });
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
    const types = await invoke<ColumnMeta[]>("infer_column_types", {
      path: this.workbook.filePath,
      sheet: this.name,
      headerRow: this.headerRow,
      skipRows: this.skipRows,
    });

    types.forEach((type, index) => {
      if (index < this._columns.length) {
        const col = this._columns[index];
        col.dbColumn;
        if (col.type === "sheet") {
          this._columns[index] = {
            ...col,
            dbColumn: {
              ...col.dbColumn,
              type: type.type,
              length: type.length,
              precision: type.precision,
              scale: type.scale,
            },
          };
        }
      }
    });
  }
}
