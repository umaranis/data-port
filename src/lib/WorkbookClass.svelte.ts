export class WorkbookClass {
  public sheets: SheetClass[] = $state([]);
  public selectedSheet: SheetClass | null = $state(null);
}

export type SheetAction = "create" | "append" | "recreate" | "skip";

export class SheetClass {
  public name: string;
  public tableName: string = $state("");
  public action: SheetAction = $state("create");
  public headerRow: number = $state(0);
  public skipRows: number[] = $state([]);

  constructor(name: string) {
    this.name = name;
    this.tableName = name.toLocaleLowerCase().replaceAll(" ", "_");
  }
}
