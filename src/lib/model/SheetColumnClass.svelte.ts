import type { ColumnMeta } from "./pgTypes";

export type SheetColumn =
  | {
      type: "sheet";
      readonly header: string;
      readonly dbColumn: ColumnMeta;
      excluded: boolean;
    }
  | {
      type: "duplicate"; // one sheet header mapped to multiple db table columns
      readonly header: string;
      readonly dbColumn: ColumnMeta;
    }
  | {
      type: "static";
      text: string | null;
      readonly dbColumn: ColumnMeta;
    }
  | {
      type: "formula";
      dbColumn: ColumnMeta;
      formula: string | null;
    }
  | {
      type: "db-serial";
      dbColumn: ColumnMeta;
      dbSequenceName: string | null;
    }
  | {
      type: "custom-sequence";
      dbColumn: ColumnMeta;
      sequenceStart: number | null;
      padding: number | null;
      prefix: string | null;
      postfix: string | null;
    };
