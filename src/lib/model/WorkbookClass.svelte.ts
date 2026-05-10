import { invoke } from "@tauri-apps/api/core";
import { SheetClass } from "./SheetClass.svelte";
import { AsyncResource } from "./AsyncResource.svelte";
import { DatabaseClass } from "./DatabaseClass.svelte";

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
