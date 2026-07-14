import { describe, it, expect } from "vitest";
import { SheetMappingClass } from "./SheetMappingClass.svelte";
import { DatabaseClass } from "./DatabaseClass.svelte";
import type { SheetClass } from "./SheetClass.svelte";
import type { ProjectMapping } from "./projectTypes";
import type { ColumnMapping } from "./mappingTypes";

/** A minimal stand-in for the Sheet the Mapping is built against. `ddl` never
 * touches the workbook, so only the name (used to seed the default table) matters. */
function stubSheet(name = "Orders"): SheetClass {
  return { name } as unknown as SheetClass;
}

/** Build a Mapping over a real (non-overridden) DatabaseClass and load `saved`
 * through the deserialize path — the primary seam for asserting generated DDL. */
function mapping(saved: ProjectMapping, dbType: "postgres" | "db2" = "postgres") {
  const database = new DatabaseClass();
  database.dbType = dbType;
  const m = new SheetMappingClass(stubSheet(), database);
  m.deserialize(saved);
  return m;
}

const sheetCol = (index: number): ColumnMapping["source"] => ({
  kind: "sheet",
  sheetColIndex: index,
});

describe("SheetMappingClass.ddl — domain filtering", () => {
  it("append mappings render no DDL", () => {
    const m = mapping({
      action: "append",
      tableName: "orders",
      columns: [
        { target: { dbColName: "id", dataType: "integer" }, source: sheetCol(0) },
      ],
    });
    expect(m.ddl).toBe("");
  });

  it("a blank target table name renders no DDL", () => {
    const m = mapping({
      action: "create",
      tableName: null,
      columns: [
        { target: { dbColName: "id", dataType: "integer" }, source: sheetCol(0) },
      ],
    });
    expect(m.ddl).toBe("");
  });

  it("no participating (non-none) columns renders no DDL", () => {
    const m = mapping({
      action: "create",
      tableName: "orders",
      columns: [
        {
          target: { dbColName: "id", dataType: "integer" },
          source: { kind: "none" },
        },
      ],
    });
    expect(m.ddl).toBe("");
  });

  it("none-Source columns are excluded from the CREATE", () => {
    const m = mapping({
      action: "create",
      tableName: "orders",
      columns: [
        { target: { dbColName: "id", dataType: "integer" }, source: sheetCol(0) },
        {
          target: { dbColName: "ignored", dataType: "text" },
          source: { kind: "none" },
        },
      ],
    });
    expect(m.ddl).toBe('CREATE TABLE "orders" (\n  "id" INTEGER\n);');
  });

  it("blank-named columns are excluded but still count as participating", () => {
    const m = mapping({
      action: "create",
      tableName: "orders",
      columns: [
        { target: { dbColName: "id", dataType: "integer" }, source: sheetCol(0) },
        { target: { dbColName: "", dataType: "text" }, source: sheetCol(1) },
      ],
    });
    expect(m.ddl).toBe('CREATE TABLE "orders" (\n  "id" INTEGER\n);');
  });

  it("a lone blank-named participating column yields an empty column list, not empty DDL", () => {
    const m = mapping({
      action: "create",
      tableName: "orders",
      columns: [
        { target: { dbColName: "", dataType: "text" }, source: sheetCol(0) },
      ],
    });
    expect(m.ddl).toBe('CREATE TABLE "orders" (\n\n);');
  });
});

describe("SheetMappingClass.ddl — action and dialect", () => {
  it("create renders CREATE TABLE only", () => {
    const m = mapping({
      action: "create",
      tableName: "orders",
      columns: [
        { target: { dbColName: "note", dataType: "text" }, source: sheetCol(0) },
      ],
    });
    expect(m.ddl).toBe('CREATE TABLE "orders" (\n  "note" TEXT\n);');
  });

  it("recreate prepends DROP TABLE IF EXISTS", () => {
    const m = mapping({
      action: "recreate",
      tableName: "orders",
      columns: [
        { target: { dbColName: "note", dataType: "text" }, source: sheetCol(0) },
      ],
    });
    expect(m.ddl).toBe(
      'DROP TABLE IF EXISTS "orders";\n' +
        'CREATE TABLE "orders" (\n  "note" TEXT\n);',
    );
  });

  it("renders DB2 type strings when the dialect is db2", () => {
    const m = mapping(
      {
        action: "create",
        tableName: "orders",
        columns: [
          { target: { dbColName: "note", dataType: "text" }, source: sheetCol(0) },
        ],
      },
      "db2",
    );
    expect(m.ddl).toBe('CREATE TABLE "orders" (\n  "note" CLOB(1M)\n);');
  });
});
