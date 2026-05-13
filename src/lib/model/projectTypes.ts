import type { SheetAction } from "./SheetClass.svelte";
import type { SheetColumn } from "./SheetColumnClass.svelte";

export type DbType = "postgres" | "db2";

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
  dbType: DbType | null;
  connectionString: string | null;
  sheets: ProjectSheet[];
};
