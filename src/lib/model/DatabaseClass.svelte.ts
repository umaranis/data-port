import { invoke } from "@tauri-apps/api/core";
import type { ColumnMeta } from "./pgTypes";
import { AsyncResource } from "./AsyncResource.svelte";

export class DatabaseClass extends AsyncResource {
  private _connectionString: string | null = $state(null);
  get connectionString(): string | null {
    return this._connectionString;
  }
  set connectionString(value: string | null) {
    this._connectionString = value;

    if (value) {
      this.load(async () => {
        return invoke<string[]>("pg_get_tables", {
          connString: this.connectionString,
        }).then((tables) => {
          this._tables = tables;
        });
      });
    } else {
      this._tables = [];
    }
  }

  private _tables: string[] = $state.raw([]);
  public get tables(): ReadonlyArray<string> {
    return this._tables;
  }

  private _dbColumns: Map<string, ColumnMeta[]> = $state(new Map());
  public async loadDbColumns(
    tableName: string,
  ): Promise<ReadonlyArray<ColumnMeta>> {
    let table = this._dbColumns.get(tableName);
    if (!table) {
      try {
        table = await invoke<ColumnMeta[]>("get_database_columns", {
          connectionString: this.connectionString!,
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
