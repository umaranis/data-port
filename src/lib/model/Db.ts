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

/** A stateless database adapter owning everything that differs between dialects:
 * the Tauri command names and the type-string dialect. The connection string is
 * received per call; connection state lives in `DatabaseClass`. */
export interface Db {
  getTables(connString: string): Promise<string[]>;
  getColumns(connString: string, tableName: string): Promise<DbColumn[]>;
  execute(connString: string, sql: string): Promise<void>;
  insertRows(params: InsertRowsParams): Promise<number>;
  typeStr(meta: TypeMeta): string;
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
};
