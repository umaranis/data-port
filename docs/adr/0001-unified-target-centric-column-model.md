# Unified target-centric column model for mappings

## Status

accepted

## Context

A mapping describes how one sheet loads into one database table, in two scenarios: **create** a new table (columns authored by the user, seeded from sheet columns) and **append** to an existing table (columns fixed by the DB schema). The original code modelled these as two different shapes and branched on them throughout the UI, SQL generation, and insert path.

## Decision

A mapping owns a single ordered list of `ColumnMapping`, each being a **target column** (db name + type/length/precision/scale) paired with a **source** (`sheet(colIndex) | static | expression | dbSerial | customSequence | none`). Both scenarios use this one shape; they differ only in *provenance* (create seeds targets from sheet columns and lets the user edit/add/remove them; append fills the list from the DB schema as read-only) and in which end the user edits (create edits the target definition, append edits the source). A target with no source is omitted from the INSERT so the DB supplies its default.

## Consequences

- The old `duplicate` column type disappears — two targets sourcing the same sheet column express it. `formula` is renamed `expression`.
- Sheet sources are referenced by **column index**, not header name, because the app allows duplicate/blank headers.
- The insert command takes a per-target source spec rather than positional `columnNames`/`columnTypes` arrays.
- Considered and rejected: keeping the two separate shapes. It duplicated logic across every consumer (UI, preview, SQL, insert) and the divergence would only grow as source types were added.
