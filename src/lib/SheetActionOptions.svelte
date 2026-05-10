<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { SheetClass } from "$lib/model/SheetClass.svelte";
  import { type InsertStatus } from "$lib/model/SheetDataClass.svelte";
  import GenerateSqlDialog from "$lib/GenerateSqlDialog.svelte";
  import type { ColumnMeta } from "./model/pgTypes";
  import { Button } from "$lib/components/ui/button";
  import { getDatabaseContext } from "./model/databaseContext";

  type Props = {
    sheet: SheetClass;
  };

  let { sheet }: Props = $props();

  let sqlDialog = $state<GenerateSqlDialog | null>(null);
  let database = getDatabaseContext();

  $effect(() => {
    if (sheet.action === "append") {
      const match = database.tables.find(
        (t) => t === sheet.tableName || t.split(".").pop() === sheet.tableName,
      );
      sheet.tableName = match ?? "";
    }
  });

  let insertStatus = $state<InsertStatus | null>(null);
  let inserting = $state(false);

  async function insertRows() {
    if (!sheet.loaded || !sheet.tableName || !database.connectionString) return;

    const anyBlankColumnName = sheet.columns.find((c, i) => !c.dbColumn.name);
    if (anyBlankColumnName) {
      insertStatus = {
        success: false,
        error: "All column names must be set before inserting.",
      };
      return;
    }
    inserting = true;
    insertStatus = null;
    insertStatus = await sheet.data.insertAllRows(database);
    inserting = false;
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
      <Button
        variant="outline"
        size="sm"
        onclick={() => sheet.inferColumnTypes()}>Infer types</Button
      >
      <Button
        variant="outline"
        size="sm"
        disabled={sheet.columns.length === 0}
        onclick={() => sqlDialog?.open()}
      >
        Generate SQL
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!database.connectionString || !sheet.tableName || inserting}
        onclick={() => insertRows()}
      >
        {inserting ? "Inserting…" : "Insert rows"}
      </Button>
    </div>
    {#if insertStatus}
      <p
        class="text-xs px-1 {insertStatus.success
          ? 'text-green-700 dark:text-green-400'
          : 'text-red-700 dark:text-red-400'}"
      >
        {insertStatus.success
          ? `${insertStatus.count} rows inserted.`
          : insertStatus.error}
      </p>
    {/if}
  </div>
  <GenerateSqlDialog
    bind:this={sqlDialog}
    {sheet}
    connectionString={database.connectionString}
    dropTable={sheet.action === "recreate"}
  />
{:else if sheet.action === "append"}
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-2">
      <label for="append-table" class="text-sm whitespace-nowrap"
        >Append to table:</label
      >
      {#if database.tables.length === 0}
        <span class="text-sm text-gray-400">No tables found</span>
      {:else}
        <select
          id="append-table"
          bind:value={sheet.tableName}
          class="border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600"
        >
          <option value="">— none —</option>
          {#each database.tables as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
      {/if}
      <Button
        variant="outline"
        size="sm"
        disabled={!database.connectionString || !sheet.tableName || inserting}
        onclick={() => insertRows()}
      >
        {inserting ? "Inserting…" : "Insert rows"}
      </Button>
    </div>
    {#if insertStatus}
      <p
        class="text-xs px-1 {insertStatus.success
          ? 'text-green-700 dark:text-green-400'
          : 'text-red-700 dark:text-red-400'}"
      >
        {insertStatus.success
          ? `${insertStatus.count} rows inserted.`
          : insertStatus.error}
      </p>
    {/if}
  </div>
{:else}
  <div></div>
{/if}
