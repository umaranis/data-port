import { invoke } from "@tauri-apps/api/core";
import { SheetClass } from "./SheetClass.svelte";
import { AsyncResource } from "./AsyncResource.svelte";
import { DatabaseClass } from "./DatabaseClass.svelte";
import type { ProjectSheet } from "./projectTypes";

export class WorkbookClass extends AsyncResource {
  public filePath: string;
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

  applySnapshot(saved: ProjectSheet[]) {
    for (const data of saved) {
      const sheet = this.sheets.find((s) => s.name === data.name);
      if (sheet) sheet.applySnapshot(data);
    }
  }

  constructor(filePath: string) {
    super();
    this.filePath = $state(filePath);

    this.load(async () => {
      invoke<string[]>("get_sheets", {
        path: this.filePath,
      }).then((sheetNames) => {
        this.sheets = sheetNames.map((n) => new SheetClass(n, this));
        this.selectedSheet = this.sheets[0] ?? null;
      });
    });
  }
}
