import type { ColumnMapping, MappingAction } from "./mappingTypes";

export type DbType = "postgres" | "db2";

export type ProjectMapping = {
  action: MappingAction;
  tableName: string | null;
  columns: ColumnMapping[];
};

export type ProjectSheet = {
  name: string;
  skipped: boolean;
  headerRow: number;
  skipRows: number[];
  mappings: ProjectMapping[];
};

export type Project = {
  name: string;
  filePath: string;
  dbType: DbType | null;
  connectionString: string | null;
  sheets: ProjectSheet[];
};
