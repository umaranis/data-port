export class WorkbookClass {
  public sheets: Sheet[] = $state([]);
  public selectedSheet: Sheet | null = $state(null);
}

export type SheetAction = "create" | "append" | "recreate" | "skip";

export class Sheet {
  public name: string;
  public action: SheetAction = $state("create");

  constructor(name: string) {
    this.name = name;
  }
}
