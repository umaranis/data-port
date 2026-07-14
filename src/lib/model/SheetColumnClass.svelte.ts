import type { PgType } from "./pgTypes";

/** A column that exists in the source sheet, identified by its header. This is
 * pure source-side metadata: the header text plus a suggested type used only to
 * seed create Mappings. All mapping/database concerns live on the Mapping. */
export type SheetColumn = {
  header: string;
  dataType: PgType;
  length?: number;
  precision?: number;
  scale?: number;
};
