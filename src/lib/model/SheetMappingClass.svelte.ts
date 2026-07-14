import { invoke } from "@tauri-apps/api/core";
import type { DatabaseClass } from "./DatabaseClass.svelte";
import type { SheetClass } from "./SheetClass.svelte";
import { convertToDBFriendlyName, type DbColumn, type PgType } from "./pgTypes";
import {
  isMaterialized,
  type ColumnMapping,
  type MappingAction,
  type Source,
} from "./mappingTypes";
import type { ProjectMapping } from "./projectTypes";
import type { InsertStatus } from "./SheetDataClass.svelte";

/** Describes how one Sheet loads into one database table: its Action, its target
 * table name, and an ordered list of Column Mappings (Target Column + Source). */
export class SheetMappingClass {
  private sheet: SheetClass;
  private database: DatabaseClass;

  constructor(sheet: SheetClass, database: DatabaseClass) {
    this.sheet = sheet;
    this.database = database;
    this._tableName = $state(convertToDBFriendlyName(sheet.name));
    this._action = $state("create");
    this._columns = $state([]);
  }

  private _action: MappingAction;
  public get action(): MappingAction {
    return this._action;
  }
  public async setAction(value: MappingAction) {
    const wasAppend = this._action === "append";
    this._action = value;
    if (value === "append") {
      // Prefer a DB table matching the current target name.
      const match = this.database.tables.find(
        (t) => t === this._tableName || t.split(".").pop() === this._tableName,
      );
      await this.setTableName(match ?? null);
    } else {
      if (!this._tableName) {
        this._tableName = convertToDBFriendlyName(this.sheet.name);
      }
      // Only (re)seed from the sheet when there is nothing author-editable yet,
      // or when coming back from append (whose targets came from the DB schema).
      // Toggling between create and recreate preserves the user's edits.
      if (wasAppend || this._columns.length === 0) {
        this.seedFromSheet();
      }
    }
  }

  private _tableName: string | null;
  public get tableName(): string | null {
    return this._tableName;
  }
  public async setTableName(value: string | null) {
    this._tableName = value;
    if (this._action === "append") {
      await this.reMatchFromDb();
    }
  }
  /** Plain setter for create/recreate where no DB re-match is needed. */
  public set tableName(value: string | null) {
    this._tableName = value;
  }

  private _columns: ColumnMapping[];
  public get columns(): ReadonlyArray<ColumnMapping> {
    return this._columns;
  }

  public get isReadOnlyTarget(): boolean {
    return this._action === "append";
  }

  /** Append a new Target Column (create/recreate only). It starts unnamed with a
   * `none` Source so the user can author its name, type, and Source. */
  public addColumn() {
    if (this._action === "append") return;
    this._columns = [
      ...this._columns,
      {
        target: { dbColName: "", dataType: "text" as PgType },
        source: { kind: "none" } as Source,
      },
    ];
  }

  /** Remove the Target Column at `index` (create/recreate only). */
  public removeColumn(index: number) {
    if (this._action === "append") return;
    this._columns = this._columns.filter((_, i) => i !== index);
  }

  /** Seed one Target Column per Sheet Column, each sourced from that column. */
  public seedFromSheet() {
    this._columns = this.sheet.columns.map((col, i) => ({
      target: {
        dbColName: convertToDBFriendlyName(col.header),
        dataType: col.dataType,
        length: col.length,
        precision: col.precision,
        scale: col.scale,
      },
      source: { kind: "sheet", sheetColIndex: i } as Source,
    }));
  }

  /** Fill the column list from the existing table's schema (read-only targets),
   * auto-matching each column's Source to the Sheet Column whose friendly name
   * matches, stored by index. */
  private async reMatchFromDb() {
    if (!this._tableName) {
      this._columns = [];
      return;
    }
    const dbCols = await this.database.loadDbColumns(this._tableName);
    const used = new Set<number>();
    this._columns = dbCols.map((dbCol) => {
      const idx = this.sheet.columns.findIndex(
        (sc, i) =>
          !used.has(i) &&
          convertToDBFriendlyName(sc.header) === dbCol.dbColName,
      );
      let source: Source = { kind: "none" };
      if (idx >= 0) {
        used.add(idx);
        source = { kind: "sheet", sheetColIndex: idx };
      }
      return {
        target: {
          dbColName: dbCol.dbColName,
          dataType: dbCol.dataType,
          length: dbCol.length,
          precision: dbCol.precision,
          scale: dbCol.scale,
        },
        source,
      };
    });
  }

  /** Re-seed create/recreate mappings after the Sheet's columns change (e.g. the
   * header row moved). Append mappings are unaffected — their targets come from
   * the DB, not the sheet. */
  public onSheetColumnsChanged() {
    if (this._action !== "append") {
      this.seedFromSheet();
    }
  }

  /** Apply inferred column types to create/recreate targets, matching by the
   * Sheet Column each target is sourced from. */
  public applyInferredTypes(types: DbColumn[]) {
    if (this._action === "append") return;
    this._columns = this._columns.map((cm) => {
      if (cm.source.kind !== "sheet") return cm;
      const t = types[cm.source.sheetColIndex];
      if (!t) return cm;
      return {
        ...cm,
        target: {
          ...cm.target,
          dataType: t.dataType,
          length: t.length,
          precision: t.precision,
          scale: t.scale,
        },
      };
    });
  }

  /** True when every target that will actually be written has a non-empty column
   * name. Unmapped/deferred Sources are omitted from the INSERT, so a blank name
   * on those doesn't block the load. */
  public get allColumnNamesSet(): boolean {
    return this._columns.every(
      (cm) => !isMaterialized(cm.source) || !!cm.target.dbColName,
    );
  }

  public async insertRows(): Promise<InsertStatus> {
    try {
      const command =
        this.database.dbType === "db2" ? "db2_insert_rows" : "pg_insert_rows";
      const targets = this._columns.map((cm) => ({
        dbColName: cm.target.dbColName ?? "",
        dataType: cm.target.dataType,
        source: cm.source,
      }));
      const count = await invoke<number>(command, {
        connString: this.database.connectionString,
        path: this.sheet.workbook.filePath,
        sheet: this.sheet.name,
        tableName: this._tableName,
        targets,
        headerRow: this.sheet.headerRow,
        skipRows: this.sheet.skipRows,
      });
      return { success: true, count };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  public toSnapshot(): ProjectMapping {
    return {
      action: this._action,
      tableName: this._tableName,
      columns: this._columns.map((cm) => ({
        target: { ...cm.target },
        source: { ...cm.source },
      })),
    };
  }

  public deserialize(saved: ProjectMapping) {
    this._action = saved.action;
    this._tableName = saved.tableName;
    this._columns = saved.columns.map((cm) => ({
      target: { ...cm.target },
      source: { ...cm.source },
    }));
  }
}
