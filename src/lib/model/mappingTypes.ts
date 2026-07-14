import type { DbColumn } from "./pgTypes";

/** What a mapping does to its target table. "skip" is no longer here — it is the
 * Sheet-level `skipped` flag. */
export type MappingAction = "create" | "append" | "recreate";

/** Where a Target Column's values come from. A `sheet` Source references its
 * column by index (position), not header name, because the sheet may have
 * duplicate or blank headers. */
export type Source =
  | { kind: "sheet"; sheetColIndex: number }
  | { kind: "static"; value: string | null }
  | { kind: "expression"; expression: string | null }
  | { kind: "db-serial"; dbSequenceName: string | null }
  | {
      kind: "custom-sequence";
      sequenceStart: number | null;
      padding: number | null;
      prefix: string | null;
      postfix: string | null;
    }
  | { kind: "none" };

/** One entry in a Mapping's ordered column list: a Target Column paired with the
 * Source that fills it. */
export type ColumnMapping = {
  target: DbColumn;
  source: Source;
};

/** Sources whose values this app resolves at load time. Everything else
 * (expression, db-serial, custom-sequence, none) is modelled and selectable but
 * omitted from the INSERT for now. */
export function isMaterialized(source: Source): boolean {
  return source.kind === "sheet" || source.kind === "static";
}
