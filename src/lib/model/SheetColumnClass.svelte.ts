import type { DbColumn } from "./pgTypes";

export type SheetColumn =
  | ({
      type: "sheet";
      readonly header: string;
      excluded: boolean;
    } & DbColumn)
  | ({
      type: "duplicate";
      readonly header: string;
    } & DbColumn)
  | ({
      type: "static";
      text: string | null;
    } & DbColumn)
  | ({
      type: "formula";
      formula: string | null;
    } & DbColumn)
  | ({
      type: "db-serial";
      dbSequenceName: string | null;
    } & DbColumn)
  | ({
      type: "custom-sequence";
      sequenceStart: number | null;
      padding: number | null;
      prefix: string | null;
      postfix: string | null;
    } & DbColumn);
