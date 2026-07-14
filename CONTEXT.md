# Data Port

Desktop app for loading spreadsheet data into relational database tables. The user opens a workbook, and for each sheet defines how its data lands in the database.

## Language

**Workbook**:
One opened spreadsheet file. Contains sheets.

**Sheet**:
One tab of a workbook, treated purely as a data _source_. Owns the header row, skipped rows, its raw columns, and paged data. Holds one or more Mappings.

**Mapping**:
A description of how one sheet loads into one database table. Owns its action, target table name, and per-column assignments. A sheet may have several mappings (e.g. one sheet feeding two tables).
_Avoid_: Sheet mapping, table mapping (when the sheet/table is clear from context)

**Action**:
What a mapping does to its target table: create, append, or recreate. Belongs to the Mapping, not the Sheet.

**Skipped**:
A sheet-level flag. A skipped sheet is excluded from loading entirely; its mappings are ignored. Distinct from Action — "skip" is a property of the Sheet, not a mapping choice.

**Sheet Column**:
A column that exists in the source sheet, identified by its header.

**Target Column**:
A column in the destination database table. In a create mapping its name and type are authored by the user (seeded from a sheet column); in an append mapping they come fixed from the existing table schema.

**Column Mapping**:
One entry in a mapping's ordered column list: a target column paired with the source that fills it. The unit the Mapping view edits.

**Source**:
Where a target column's values come from: a sheet column, a static value, an expression, a database serial/sequence, a custom sequence, or nothing. A given sheet column may be the source for more than one target column (this replaces the old "duplicate" column concept). A target with no source is omitted from the INSERT so the database supplies its own default.
_Avoid_: Formula (use "expression"), Duplicate column

**Preview**:
A per-mapping view of what will land in the target table: a resolved data grid (target columns, values pulled from each source) plus the generated SQL. Sources not yet evaluated (expression, serial, custom sequence) render as placeholder tokens in the grid.
