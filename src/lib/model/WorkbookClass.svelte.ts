import { invoke } from "@tauri-apps/api/core";
import { SheetClass } from "./SheetClass.svelte";
import { AsyncResource } from "./AsyncResource.svelte";
import type { Project, ProjectSheet } from "./projectTypes";

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

  constructor() {
    super();
  }

  static create(filePath: string) {
    let wb = new WorkbookClass();
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

  static async deserialize(project: Project) {
    const wb = new WorkbookClass();
    wb._filePath = project.filePath;
    let sheetNames = await invoke<string[]>("get_sheets", {
      path: wb.filePath,
    });
    wb.sheets = sheetNames.map((n) => new SheetClass(n, wb));

    wb.sheets = project.sheets.map((s) => new SheetClass(s.name, wb));
    wb.applySnapshot(project.sheets);

    wb.selectedSheet = wb.sheets[0] ?? null;
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
