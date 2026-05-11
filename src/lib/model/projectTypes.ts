import type { SheetAction } from "./SheetClass.svelte";
import type { SheetColumn } from "./SheetColumnClass.svelte";

export type ProjectSheet = {
  name: string;
  action: SheetAction;
  tableName: string | null;
  headerRow: number;
  skipRows: number[];
  columns: Readonly<SheetColumn>[];
};

export type Project = {
  name: string;
  filePath: string;
  connectionString: string | null;
  sheets: ProjectSheet[];
};
