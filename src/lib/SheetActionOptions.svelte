<script lang="ts">
  import { type SheetAction } from "$lib/Workbook.svelte";
  import InferTypesButton from "$lib/InferTypesButton.svelte";
  import type { ColumnMeta } from "./pgTypes";

  type Props = {
    sheetAction: SheetAction;
    dbTables: string[];
    tableName: string;
    selectedTable: string;
    filePath: string | null;
    sheet: string | null;
    headerRow: number;
    skipRows: number[];
    oninfer: (types: ColumnMeta[]) => void;
  };

  let {
    sheetAction,
    dbTables,
    tableName = $bindable(),
    selectedTable = $bindable(),
    filePath,
    sheet,
    headerRow,
    skipRows,
    oninfer,
  }: Props = $props();
</script>

{#if sheetAction === "create"}
  <div class="flex items-center gap-2">
    <label for="table-name" class="text-sm whitespace-nowrap">Table name:</label
    >
    <input
      id="table-name"
      type="text"
      bind:value={tableName}
      class="border rounded px-2 py-1 text-sm w-48"
    />
    <InferTypesButton {filePath} {sheet} {headerRow} {skipRows} {oninfer} />
  </div>
{:else if sheetAction === "append"}
  <div class="flex items-center gap-2">
    <label for="append-table" class="text-sm whitespace-nowrap"
      >Append to table:</label
    >
    {#if dbTables.length === 0}
      <span class="text-sm text-gray-400">No tables found</span>
    {:else}
      <select
        id="append-table"
        bind:value={selectedTable}
        class="border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600"
      >
        <option value="">— none —</option>
        {#each dbTables as t}
          <option value={t}>{t}</option>
        {/each}
      </select>
    {/if}
  </div>
{:else}
  <div></div>
{/if}
