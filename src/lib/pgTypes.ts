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
  text:               {},
  varchar:            { length: true },
  integer:            {},
  bigint:             {},
  numeric:            { precision: true, scale: true },
  boolean:            {},
  date:               {},
  timestamp:          { precision: true },
  timestamptz:        { precision: true },
  "double precision": {},
  jsonb:              {},
  uuid:               {},
};

export type ColumnMeta = {
  type: PgType;
  name?: string;
  length?: number;
  precision?: number;
  scale?: number;
};
