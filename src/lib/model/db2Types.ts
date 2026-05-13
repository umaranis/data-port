import type { PgType } from "./pgTypes";

export function db2TypeStr(meta: {
  dataType: PgType;
  length?: number;
  precision?: number;
  scale?: number;
}): string {
  switch (meta.dataType) {
    case "varchar":
      return meta.length ? `VARCHAR(${meta.length})` : "VARCHAR(255)";
    case "text":
      return "CLOB(1M)";
    case "integer":
      return "INTEGER";
    case "bigint":
      return "BIGINT";
    case "numeric":
      if (meta.precision != null && meta.scale != null)
        return `DECIMAL(${meta.precision}, ${meta.scale})`;
      if (meta.precision != null) return `DECIMAL(${meta.precision})`;
      return "DECIMAL(31, 6)";
    case "boolean":
      // Requires Db2 11.1+
      return "BOOLEAN";
    case "date":
      return "DATE";
    case "timestamp":
      return meta.precision != null
        ? `TIMESTAMP(${meta.precision})`
        : "TIMESTAMP";
    case "timestamptz":
      // Requires Db2 11.5+; use TIMESTAMP for older versions
      return "TIMESTAMP WITH TIME ZONE";
    case "double precision":
      return "DOUBLE";
    case "jsonb":
      return "CLOB(1M)";
    case "uuid":
      return "CHAR(36)";
    default:
      return "VARCHAR(255)";
  }
}
