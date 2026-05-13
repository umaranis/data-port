import { invoke } from "@tauri-apps/api/core";
import type { DbColumn } from "./pgTypes";
import type { DbType } from "./projectTypes";
import { AsyncResource } from "./AsyncResource.svelte";

export class DatabaseClass extends AsyncResource {
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
        const command =
          this._dbType === "db2" ? "db2_get_tables" : "pg_get_tables";
        return invoke<string[]>(command, {
          connString: this.connectionString,
        }).then((tables) => {
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

  private _dbColumns: Map<string, DbColumn[]> = $state(new Map());
  public async loadDbColumns(
    tableName: string,
  ): Promise<ReadonlyArray<DbColumn>> {
    let table = this._dbColumns.get(tableName);
    if (!table) {
      try {
        const command =
          this._dbType === "db2" ? "db2_get_columns" : "pg_get_columns";
        table = await invoke<DbColumn[]>(command, {
          connString: this.connectionString!,
          tableName,
        });
      } catch (e) {
        this.error = String(e);
        return [];
      }
      this._dbColumns.set(tableName, table);
    }
    return table;
  }
}
