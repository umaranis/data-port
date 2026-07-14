import { describe, it, expect } from "vitest";
import { flushSync } from "svelte";
import { DatabaseClass } from "./DatabaseClass.svelte";
import type { Db, InsertRowsParams, TypeMeta } from "./Db";
import type { DbColumn } from "./pgTypes";

/** A fake adapter that records every call and returns canned values, so tests can
 * assert routing/caching/selection without mocking Tauri `invoke`. */
class FakeDb implements Db {
  public getTablesCalls: string[] = [];
  public getColumnsCalls: { connString: string; tableName: string }[] = [];
  public executeCalls: { connString: string; sql: string }[] = [];
  public insertRowsCalls: InsertRowsParams[] = [];

  constructor(
    private readonly opts: {
      tables?: string[];
      columns?: DbColumn[];
      insertCount?: number;
      typeStr?: string;
    } = {},
  ) {}

  getTables(connString: string): Promise<string[]> {
    this.getTablesCalls.push(connString);
    return Promise.resolve(this.opts.tables ?? []);
  }
  getColumns(connString: string, tableName: string): Promise<DbColumn[]> {
    this.getColumnsCalls.push({ connString, tableName });
    return Promise.resolve(this.opts.columns ?? []);
  }
  execute(connString: string, sql: string): Promise<void> {
    this.executeCalls.push({ connString, sql });
    return Promise.resolve();
  }
  insertRows(params: InsertRowsParams): Promise<number> {
    this.insertRowsCalls.push(params);
    return Promise.resolve(this.opts.insertCount ?? 0);
  }
  typeStr(_meta: TypeMeta): string {
    return this.opts.typeStr ?? "FAKE";
  }
}

describe("DatabaseClass adapter routing", () => {
  it("getTables routes to the adapter with connectionString passed through", async () => {
    const fake = new FakeDb({ tables: ["public.users"] });
    const db = new DatabaseClass(fake);
    db.connectionString = "conn-1";

    const tables = await db.getTables();

    expect(tables).toEqual(["public.users"]);
    expect(fake.getTablesCalls).toContain("conn-1");
  });

  it("loadDbColumns routes to the adapter with connectionString passed through", async () => {
    const columns: DbColumn[] = [{ dataType: "text", dbColName: "name" }];
    const fake = new FakeDb({ columns });
    const db = new DatabaseClass(fake);
    db.connectionString = "conn-1";

    const result = await db.loadDbColumns("orders");

    expect(result).toEqual(columns);
    expect(fake.getColumnsCalls).toEqual([
      { connString: "conn-1", tableName: "orders" },
    ]);
  });

  it("execute routes to the adapter with connectionString passed through", async () => {
    const fake = new FakeDb();
    const db = new DatabaseClass(fake);
    db.connectionString = "conn-1";

    await db.execute("SELECT 1");

    expect(fake.executeCalls).toEqual([
      { connString: "conn-1", sql: "SELECT 1" },
    ]);
  });

  it("insertRows routes to the adapter with connectionString passed through", async () => {
    const fake = new FakeDb({ insertCount: 42 });
    const db = new DatabaseClass(fake);
    db.connectionString = "conn-1";

    const count = await db.insertRows({
      path: "/tmp/book.xlsx",
      sheet: "Sheet1",
      tableName: "orders",
      targets: [],
      headerRow: 0,
      skipRows: [],
    });

    expect(count).toBe(42);
    expect(fake.insertRowsCalls).toEqual([
      {
        connString: "conn-1",
        path: "/tmp/book.xlsx",
        sheet: "Sheet1",
        tableName: "orders",
        targets: [],
        headerRow: 0,
        skipRows: [],
      },
    ]);
  });
});

describe("DatabaseClass column caching", () => {
  it("loadDbColumns caches — a repeat call for the same table does not re-hit the adapter", async () => {
    const fake = new FakeDb({ columns: [{ dataType: "text" }] });
    const db = new DatabaseClass(fake);
    db.connectionString = "conn-1";

    await db.loadDbColumns("orders");
    await db.loadDbColumns("orders");

    expect(fake.getColumnsCalls).toHaveLength(1);
  });

  it("loadDbColumns hits the adapter again for a different table", async () => {
    const fake = new FakeDb({ columns: [{ dataType: "text" }] });
    const db = new DatabaseClass(fake);
    db.connectionString = "conn-1";

    await db.loadDbColumns("orders");
    await db.loadDbColumns("customers");

    expect(fake.getColumnsCalls.map((c) => c.tableName)).toEqual([
      "orders",
      "customers",
    ]);
  });
});

describe("DatabaseClass dialect selection (no override)", () => {
  it("typeStr returns the Postgres dialect string when dbType is postgres", () => {
    const db = new DatabaseClass();
    db.dbType = "postgres";

    expect(db.typeStr({ dataType: "text" })).toBe("TEXT");
  });

  it("typeStr returns the DB2 dialect string when dbType is db2", () => {
    const db = new DatabaseClass();
    db.dbType = "db2";

    expect(db.typeStr({ dataType: "text" })).toBe("CLOB(1M)");
  });
});

describe("DatabaseClass override wins over dbType", () => {
  it("typeStr uses the injected adapter regardless of dbType", () => {
    const fake = new FakeDb({ typeStr: "FAKE-TYPE" });
    const db = new DatabaseClass(fake);
    db.dbType = "db2";

    expect(db.typeStr({ dataType: "text" })).toBe("FAKE-TYPE");
  });
});

describe("DatabaseClass connectionString still triggers table loading", () => {
  it("setting connectionString loads tables through the adapter", async () => {
    const fake = new FakeDb({ tables: ["public.users"] });
    const db = new DatabaseClass(fake);

    db.connectionString = "conn-1";
    // Let the load() promise chain settle.
    await Promise.resolve();
    await Promise.resolve();
    flushSync();

    expect(fake.getTablesCalls).toContain("conn-1");
    expect(db.tables).toEqual(["public.users"]);
  });

  it("clearing connectionString empties the table list", async () => {
    const fake = new FakeDb({ tables: ["public.users"] });
    const db = new DatabaseClass(fake);
    db.connectionString = "conn-1";
    await Promise.resolve();
    await Promise.resolve();
    flushSync();

    db.connectionString = null;

    expect(db.tables).toEqual([]);
  });
});
