<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { SheetClass } from "$lib/WorkbookClass.svelte.js";
  import InferTypesButton from "$lib/InferTypesButton.svelte";
  import GenerateSqlDialog from "$lib/GenerateSqlDialog.svelte";
  import type { ColumnMeta } from "./pgTypes";
  import { Button } from "$lib/components/ui/button";

  type Props = {
    sheet: SheetClass;
    dbTables: string[];
    filePath: string | null;
    columnMeta: ColumnMeta[];
    savedConnString?: string | null;
    oninfer: (types: ColumnMeta[]) => void;
  };

  let {
    sheet,
    dbTables,
    filePath,
    columnMeta,
    savedConnString,
    oninfer,
  }: Props = $props();

  let sqlDialog = $state<GenerateSqlDialog | null>(null);

  $effect(() => {
    if (sheet.action === "append") {
      const match = dbTables.find(
        (t) => t === sheet.tableName || t.split(".").pop() === sheet.tableName,
      );
      sheet.tableName = match ?? "";
    }
  });

  type InsertStatus =
    | { ok: true; count: number }
    | { ok: false; error: string }
    | null;
  let insertStatus = $state<InsertStatus>(null);
  let inserting = $state(false);

  async function insertRows(targetTable: string) {
    if (!filePath || !sheet.name || !savedConnString || !targetTable) return;
    const columnNames = columnMeta.map((m) => m.name ?? "");
    if (columnNames.some((n) => n === "")) {
      insertStatus = {
        ok: false,
        error: "All column names must be set before inserting.",
      };
      return;
    }
    inserting = true;
    insertStatus = null;
    try {
      const count = await invoke<number>("pg_insert_rows", {
        connString: savedConnString,
        path: filePath,
        sheet: sheet.name,
        tableName: targetTable,
        columnTypes: columnMeta.map((m) => m.type),
        columnNames,
        headerRow: sheet.headerRow,
        skipRows: sheet.skipRows,
      });
      insertStatus = { ok: true, count };
    } catch (e) {
      insertStatus = { ok: false, error: String(e) };
    } finally {
      inserting = false;
    }
  }
</script>

{#if sheet.action === "create" || sheet.action === "recreate"}
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-2">
      <label for="table-name" class="text-sm whitespace-nowrap"
        >Table name:</label
      >
      <input
        id="table-name"
        type="text"
        bind:value={sheet.tableName}
        class="border rounded px-2 py-1 text-sm w-48"
      />
      <InferTypesButton {filePath} sheet={sheet.name} headerRow={sheet.headerRow} skipRows={sheet.skipRows} {oninfer} />
      <Button
        variant="outline"
        size="sm"
        disabled={sheet.headers.length === 0}
        onclick={() => sqlDialog?.open()}
      >
        Generate SQL
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!savedConnString || !sheet.tableName || inserting}
        onclick={() => insertRows(sheet.tableName)}
      >
        {inserting ? "Inserting…" : "Insert rows"}
      </Button>
    </div>
    {#if insertStatus}
      <p
        class="text-xs px-1 {insertStatus.ok
          ? 'text-green-700 dark:text-green-400'
          : 'text-red-700 dark:text-red-400'}"
      >
        {insertStatus.ok
          ? `${insertStatus.count} rows inserted.`
          : insertStatus.error}
      </p>
    {/if}
  </div>
  <GenerateSqlDialog
    bind:this={sqlDialog}
    tableName={sheet.tableName}
    columnHeaders={sheet.headers}
    {columnMeta}
    {savedConnString}
    dropTable={sheet.action === "recreate"}
  />
{:else if sheet.action === "append"}
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-2">
      <label for="append-table" class="text-sm whitespace-nowrap"
        >Append to table:</label
      >
      {#if dbTables.length === 0}
        <span class="text-sm text-gray-400">No tables found</span>
      {:else}
        <select
          id="append-table"
          bind:value={sheet.tableName}
          class="border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600"
        >
          <option value="">— none —</option>
          {#each dbTables as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
      {/if}
      <Button
        variant="outline"
        size="sm"
        disabled={!savedConnString || !sheet.tableName || inserting}
        onclick={() => insertRows(sheet.tableName)}
      >
        {inserting ? "Inserting…" : "Insert rows"}
      </Button>
    </div>
    {#if insertStatus}
      <p
        class="text-xs px-1 {insertStatus.ok
          ? 'text-green-700 dark:text-green-400'
          : 'text-red-700 dark:text-red-400'}"
      >
        {insertStatus.ok
          ? `${insertStatus.count} rows inserted.`
          : insertStatus.error}
      </p>
    {/if}
  </div>
{:else}
  <div></div>
{/if}
