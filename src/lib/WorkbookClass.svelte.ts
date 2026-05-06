import { type ColumnMeta } from "$lib/pgTypes";

export class WorkbookClass {
  public sheets: SheetClass[] = $state([]);
  public selectedSheet: SheetClass | null = $state(null);
}

export type SheetAction = "create" | "append" | "recreate" | "skip";

export class SheetClass {
  public name: string;
  public action: SheetAction = $state("create");
  public headerRow: number = $state(0);
  public skipRows: number[] = $state([]);
  public headers: string[] = $state([]);

  public tableName: string = $state("");
  public columnMeta: ColumnMeta[] = $state([]);

  constructor(name: string) {
    this.name = name;
    this.tableName = name.toLocaleLowerCase().replaceAll(" ", "_");
  }
}
