import { invoke } from "@tauri-apps/api/core";
import type { DbColumn, PgType } from "./pgTypes";
import { pgTypeStr } from "./pgTypes";
import { db2TypeStr } from "./db2Types";
import type { Source } from "./mappingTypes";

/** The subset of a column needed to render its dialect type string. */
export type TypeMeta = {
  dataType: PgType;
  length?: number;
  precision?: number;
  scale?: number;
};

/** One Target Column in an insert payload: its DB name, type, and Source. */
export type InsertTarget = {
  dbColName: string;
  dataType: PgType;
  source: Source;
};

/** The full payload for an insert, mirroring the Rust `*_insert_rows` command. */
export type InsertRowsParams = {
  connString: string | null;
  path: string;
  sheet: string;
  tableName: string | null;
  targets: InsertTarget[];
  headerRow: number;
  skipRows: number[];
};

/** One column in a DDL spec: its DB name plus the type metadata to render. */
export type DdlColumn = { dbColName: string } & TypeMeta;

/** A dialect-agnostic, already-filtered description of a `CREATE TABLE` (with an
 * optional preceding `DROP`). The caller does the domain filtering; the adapter
 * only renders. */
export type DdlSpec = {
  tableName: string;
  columns: DdlColumn[];
  drop: boolean;
};

/** The dialect primitives the shared DDL builder injects. Today just the
 * type-string renderer; quoting and the `DROP` clause can join it when the
 * dialects later diverge. */
type DdlDialect = {
  typeStr(meta: TypeMeta): string;
};

/** The shared `CREATE`/`DROP` structure. Every dialect renders the same shape and
 * injects only its own primitives, so structure lives in one place. */
function buildDdl(spec: DdlSpec, dialect: DdlDialect): string {
  const cols = spec.columns.map(
    (c) => `  "${c.dbColName}" ${dialect.typeStr(c)}`,
  );
  const create = `CREATE TABLE "${spec.tableName}" (\n${cols.join(",\n")}\n);`;
  return spec.drop
    ? `DROP TABLE IF EXISTS "${spec.tableName}";\n${create}`
    : create;
}

/** A stateless database adapter owning everything that differs between dialects:
 * the Tauri command names and the type-string dialect. The connection string is
 * received per call; connection state lives in `DatabaseClass`. */
export interface Db {
  getTables(connString: string): Promise<string[]>;
  getColumns(connString: string, tableName: string): Promise<DbColumn[]>;
  execute(connString: string, sql: string): Promise<void>;
  insertRows(params: InsertRowsParams): Promise<number>;
  typeStr(meta: TypeMeta): string;
  /** Render a filtered, dialect-agnostic DDL spec to SQL in this dialect. */
  renderDdl(spec: DdlSpec): string;
}

/** PostgreSQL adapter — owns the `pg_*` command names and the Postgres dialect. */
export const pgDb: Db = {
  getTables(connString) {
    return invoke<string[]>("pg_get_tables", { connString });
  },
  getColumns(connString, tableName) {
    return invoke<DbColumn[]>("pg_get_columns", { connString, tableName });
  },
  execute(connString, sql) {
    return invoke("pg_execute", { connString, sql });
  },
  insertRows(params) {
    return invoke<number>("pg_insert_rows", params);
  },
  typeStr(meta) {
    return pgTypeStr(meta);
  },
  renderDdl(spec) {
    return buildDdl(spec, this);
  },
};

/** DB2 adapter — owns the `db2_*` command names and the DB2 dialect. */
export const db2Db: Db = {
  getTables(connString) {
    return invoke<string[]>("db2_get_tables", { connString });
  },
  getColumns(connString, tableName) {
    return invoke<DbColumn[]>("db2_get_columns", { connString, tableName });
  },
  execute(connString, sql) {
    return invoke("db2_execute", { connString, sql });
  },
  insertRows(params) {
    return invoke<number>("db2_insert_rows", params);
  },
  typeStr(meta) {
    return db2TypeStr(meta);
  },
  renderDdl(spec) {
    return buildDdl(spec, this);
  },
};
