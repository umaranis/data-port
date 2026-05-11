import type { PgType } from "./pgTypes";

export type SheetColumn =
  | {
      type: "sheet";
      readonly header: string;
      pgType: PgType;
      name?: string;
      length?: number;
      precision?: number;
      scale?: number;
      excluded: boolean;
    }
  | {
      type: "duplicate"; // one sheet header mapped to multiple db table columns
      readonly header: string;
      pgType: PgType;
      name?: string;
      length?: number;
      precision?: number;
      scale?: number;
    }
  | {
      type: "static";
      text: string | null;
      pgType: PgType;
      name?: string;
      length?: number;
      precision?: number;
      scale?: number;
    }
  | {
      type: "formula";
      pgType: PgType;
      name?: string;
      length?: number;
      precision?: number;
      scale?: number;
      formula: string | null;
    }
  | {
      type: "db-serial";
      pgType: PgType;
      name?: string;
      length?: number;
      precision?: number;
      scale?: number;
      dbSequenceName: string | null;
    }
  | {
      type: "custom-sequence";
      pgType: PgType;
      name?: string;
      length?: number;
      precision?: number;
      scale?: number;
      sequenceStart: number | null;
      padding: number | null;
      prefix: string | null;
      postfix: string | null;
    };
