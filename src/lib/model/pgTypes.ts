export const PG_TYPES = [
  "text",
  "varchar",
  "integer",
  "bigint",
  "numeric",
  "boolean",
  "date",
  "timestamp",
  "timestamptz",
  "double precision",
  "jsonb",
  "uuid",
] as const;

export type PgType = (typeof PG_TYPES)[number];

export const TYPE_MODIFIERS: Record<
  PgType,
  { length?: true; precision?: true; scale?: true }
> = {
  text: {},
  varchar: { length: true },
  integer: {},
  bigint: {},
  numeric: { precision: true, scale: true },
  boolean: {},
  date: {},
  timestamp: { precision: true },
  timestamptz: { precision: true },
  "double precision": {},
  jsonb: {},
  uuid: {},
};

export type ColumnMeta = {
  type: PgType;
  name?: string;
  length?: number;
  precision?: number;
  scale?: number;
};

export function convertToDBFriendlyName(name: string) {
  return name
    .toLocaleLowerCase()
    .replaceAll(" ", "_")
    .replaceAll(/[^a-z0-9_]/g, "");
}

export function pgTypeStr(meta: ColumnMeta): string {
  switch (meta.type) {
    case "varchar":
      return meta.length ? `VARCHAR(${meta.length})` : "VARCHAR";
    case "numeric":
      if (meta.precision != null && meta.scale != null)
        return `NUMERIC(${meta.precision}, ${meta.scale})`;
      if (meta.precision != null) return `NUMERIC(${meta.precision})`;
      return "NUMERIC";
    case "timestamp":
      return meta.precision != null
        ? `TIMESTAMP(${meta.precision})`
        : "TIMESTAMP";
    case "timestamptz":
      return meta.precision != null
        ? `TIMESTAMPTZ(${meta.precision})`
        : "TIMESTAMPTZ";
    case "double precision":
      return "DOUBLE PRECISION";
    default:
      return meta.type.toUpperCase();
  }
}
