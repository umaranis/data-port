export class WorkbookClass {
  public sheets: SheetClass[] = $state([]);
  public selectedSheet: SheetClass | null = $state(null);
}

export type SheetAction = "create" | "append" | "recreate" | "skip";

export class SheetClass {
  public name: string;
  public action: SheetAction = $state("create");
  public headerRow: number = $state(0);

  constructor(name: string) {
    this.name = name;
  }
}
