<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { type SheetAction } from "$lib/WorkbookClass.svelte.js";
  import InferTypesButton from "$lib/InferTypesButton.svelte";
  import GenerateSqlDialog from "$lib/GenerateSqlDialog.svelte";
  import type { ColumnMeta } from "./pgTypes";
  import { Button } from "$lib/components/ui/button";

  type Props = {
    sheetAction: SheetAction;
    dbTables: string[];
    tableName: string;
    filePath: string | null;
    sheet: string | null;
    headerRow: number;
    skipRows: number[];
    columnHeaders: string[];
    columnMeta: ColumnMeta[];
    savedConnString?: string | null;
    oninfer: (types: ColumnMeta[]) => void;
  };

  let {
    sheetAction,
    dbTables,
    tableName = $bindable(),
    filePath,
    sheet,
    headerRow,
    skipRows,
    columnHeaders,
    columnMeta,
    savedConnString,
    oninfer,
  }: Props = $props();

  let sqlDialog = $state<GenerateSqlDialog | null>(null);

  $effect(() => {
    if (sheetAction === "append") {
      const match = dbTables.find(
        (t) => t === tableName || t.split(".").pop() === tableName,
      );
      tableName = match ?? "";
    }
  });

  type InsertStatus =
    | { ok: true; count: number }
    | { ok: false; error: string }
    | null;
  let insertStatus = $state<InsertStatus>(null);
  let inserting = $state(false);

  async function insertRows(targetTable: string) {
    if (!filePath || !sheet || !savedConnString || !targetTable) return;
    inserting = true;
    insertStatus = null;
    try {
      const count = await invoke<number>("pg_insert_rows", {
        connString: savedConnString,
        path: filePath,
        sheet,
        tableName: targetTable,
        columnTypes: columnMeta.map((m) => m.type),
        columnNames: columnMeta.map((m) => m.name ?? ""),
        headerRow,
        skipRows,
      });
      insertStatus = { ok: true, count };
    } catch (e) {
      insertStatus = { ok: false, error: String(e) };
    } finally {
      inserting = false;
    }
  }
</script>

{#if sheetAction === "create" || sheetAction === "recreate"}
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-2">
      <label for="table-name" class="text-sm whitespace-nowrap"
        >Table name:</label
      >
      <input
        id="table-name"
        type="text"
        bind:value={tableName}
        class="border rounded px-2 py-1 text-sm w-48"
      />
      <InferTypesButton {filePath} {sheet} {headerRow} {skipRows} {oninfer} />
      <Button
        variant="outline"
        size="sm"
        disabled={columnHeaders.length === 0}
        onclick={() => sqlDialog?.open()}
      >
        Generate SQL
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!savedConnString || !tableName || inserting}
        onclick={() => insertRows(tableName)}
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
    {tableName}
    {columnHeaders}
    {columnMeta}
    {savedConnString}
    dropTable={sheetAction === "recreate"}
  />
{:else if sheetAction === "append"}
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
          bind:value={tableName}
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
        disabled={!savedConnString || !tableName || inserting}
        onclick={() => insertRows(tableName)}
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
