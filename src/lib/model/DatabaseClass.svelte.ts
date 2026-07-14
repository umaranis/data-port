import type { DbColumn } from "./pgTypes";
import type { DbType } from "./projectTypes";
import { AsyncResource } from "./AsyncResource.svelte";
import {
  pgDb,
  db2Db,
  type Db,
  type InsertRowsParams,
  type TypeMeta,
} from "./Db";

export class DatabaseClass extends AsyncResource {
  /** Optional adapter override, injected for tests. When set it wins over the
   * `dbType`-derived adapter. */
  private readonly _dbOverride: Db | null;

  constructor(db?: Db) {
    super();
    this._dbOverride = db ?? null;
  }

  /** The active adapter: the injected override if present, otherwise the one
   * matching the reactive `dbType`. */
  private get db(): Db {
    return this._dbOverride ?? (this._dbType === "db2" ? db2Db : pgDb);
  }

  private _dbType: DbType = $state("postgres");
  get dbType(): DbType {
    return this._dbType;
  }
  set dbType(value: DbType) {
    this._dbType = value;
  }

  private _connectionString: string | null = $state(null);
  get connectionString(): string | null {
    return this._connectionString;
  }
  set connectionString(value: string | null) {
    this._connectionString = value;

    if (value) {
      this.load(async () => {
        return this.getTables().then((tables) => {
          this._tables = tables;
          this._dbColumns.clear();
        });
      });
    } else {
      this._tables = [];
      this._dbColumns.clear();
    }
  }

  private _tables: string[] = $state.raw([]);
  public get tables(): ReadonlyArray<string> {
    return this._tables;
  }

  /** List the tables in the active connection and dialect. */
  public getTables(): Promise<string[]> {
    return this.db.getTables(this.connectionString!);
  }

  private _dbColumns: Map<string, DbColumn[]> = $state(new Map());
  public async loadDbColumns(
    tableName: string,
  ): Promise<ReadonlyArray<DbColumn>> {
    let table = this._dbColumns.get(tableName);
    if (!table) {
      try {
        table = await this.db.getColumns(this.connectionString!, tableName);
      } catch (e) {
        this.error = String(e);
        return [];
      }
      this._dbColumns.set(tableName, table);
    }
    return table;
  }

  /** Run arbitrary SQL against the active connection and dialect. */
  public execute(sql: string): Promise<void> {
    return this.db.execute(this.connectionString!, sql);
  }

  /** Insert sheet rows into a table. `connString` is supplied from the owned
   * connection string; callers pass the rest of the payload. */
  public insertRows(
    params: Omit<InsertRowsParams, "connString">,
  ): Promise<number> {
    return this.db.insertRows({
      ...params,
      connString: this.connectionString,
    });
  }

  /** Render a column's type string in the active dialect. */
  public typeStr(meta: TypeMeta): string {
    return this.db.typeStr(meta);
  }
}
