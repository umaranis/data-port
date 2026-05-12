import { invoke } from "@tauri-apps/api/core";
import { SheetClass } from "./SheetClass.svelte";
import { AsyncResource } from "./AsyncResource.svelte";
import type { Project, ProjectSheet } from "./projectTypes";
import type { DatabaseClass } from "./DatabaseClass.svelte";

export class WorkbookClass extends AsyncResource {
  private _filePath: string = $state("");
  public get filePath(): string {
    return this._filePath;
  }

  public sheets: SheetClass[] = $state([]);

  private _selectedSheet: SheetClass | null = $state(null);
  public get selectedSheet(): SheetClass | null {
    return this._selectedSheet;
  }
  public set selectedSheet(value: SheetClass | null) {
    this._selectedSheet = value;
    if (value && !value.loaded) {
      value.loadSheet();
    }
  }

  private _database: DatabaseClass;
  public get database() {
    return this._database;
  }

  constructor(db: DatabaseClass) {
    super();
    this._database = db;
  }

  static create(filePath: string, db: DatabaseClass) {
    let wb = new WorkbookClass(db);
    wb._filePath = filePath;

    wb.load(async () => {
      invoke<string[]>("get_sheets", {
        path: wb.filePath,
      }).then((sheetNames) => {
        wb.sheets = sheetNames.map((n) => new SheetClass(n, wb));
        wb.selectedSheet = wb.sheets[0] ?? null;
      });
    });
    return wb;
  }

  static async deserialize(project: Project, db: DatabaseClass) {
    const wb = new WorkbookClass(db);
    wb._filePath = project.filePath;
    let sheetNames = await invoke<string[]>("get_sheets", {
      path: wb.filePath,
    });
    wb.sheets = sheetNames.map((n) => new SheetClass(n, wb));
    wb.applySnapshot(project.sheets);
    const s = wb.sheets[0];
    if (s) {
      wb._selectedSheet = s;
    }
    return wb;
  }

  private applySnapshot(saved: ProjectSheet[]) {
    for (const data of saved) {
      const sheet = this.sheets.find((s) => s.name === data.name);
      if (sheet) sheet.applySnapshot(data);
    }
  }

  toSnapshot(): ProjectSheet[] {
    return this.sheets.map((s) => ({
      name: s.name,
      action: s.action,
      tableName: s.tableName,
      headerRow: s.headerRow,
      skipRows: s.skipRows,
      columns: [...s.columns],
    }));
  }
}
