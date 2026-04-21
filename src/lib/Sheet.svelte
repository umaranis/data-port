<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import * as Table from "$lib/components/ui/table";
  import ConfirmClearSkipRows from "$lib/ConfirmClearSkipRows.svelte";
  import Paging from "$lib/Paging.svelte";
  import SheetFilters from "$lib/SheetFilters.svelte";
  import { type ColumnMeta } from "$lib/pgTypes";
  import { SkipRows } from "$lib/SkipRows.svelte";
  import { untrack } from "svelte";
  import ColumnTypeHeader from "./ColumnTypeHeader.svelte";
  import { type SheetAction } from "$lib/Workbook.svelte";

  const PAGE_SIZE = 50;

  type Props = {
    filePath: string | null;
    sheet: string | null;
    sheetAction: SheetAction;
    dbTables: string[];
  };

  let { filePath, sheet, sheetAction, dbTables }: Props = $props();

  let tableName = $state("");
  let selectedTable = $state("");

  $effect(() => {
    selectedTable = dbTables[0] ?? "";
  });

  let rows = $state<string[][]>([]);
  let currentPage = $state(0);
  let totalRows = $state(0);

  let headerRowInput = $state(1);
  let appliedHeaderRow = $state(0);

  const skipRows = new SkipRows();

  let confirmDialogOpen = $state(false);
  let pendingHeaderRow = $state(0);

  let columnMeta = $state<ColumnMeta[]>([]);

  let totalPages = $derived(Math.max(1, Math.ceil(totalRows / PAGE_SIZE)));

  function freshMeta(count: number): ColumnMeta[] {
    return Array.from({ length: count }, () => ({ type: "text" }));
  }

  function applyFilters() {
    const newHeaderRow = Math.max(0, headerRowInput - 1);
    if (
      newHeaderRow !== appliedHeaderRow &&
      (skipRows.applied.length > 0 || skipRows.input.length > 0)
    ) {
      pendingHeaderRow = newHeaderRow;
      confirmDialogOpen = true;
      return;
    }
    commitFilters(newHeaderRow);
  }

  function commitFilters(newHeaderRow: number) {
    if (newHeaderRow !== appliedHeaderRow) {
      skipRows.reset();
    }
    appliedHeaderRow = newHeaderRow;
    skipRows.apply();
    currentPage = 0;
    loadPage(0);
    confirmDialogOpen = false;
  }

  async function loadPage(page: number) {
    if (!filePath || !sheet) return;
    const result = await invoke<{ rows: string[][]; total_rows: number }>(
      "get_sheet_rows_paged_filtered",
      {
        path: filePath,
        sheet,
        page,
        pageSize: PAGE_SIZE,
        headerRow: appliedHeaderRow,
        skipRows: skipRows.applied,
      },
    );
    rows = result.rows;
    totalRows = result.total_rows;
    if (columnMeta.length !== rows[0]?.length) {
      columnMeta = freshMeta(rows[0]?.length ?? 0);
    }
  }

  async function goToPage(page: number) {
    if (page < 0 || page >= totalPages) return;
    currentPage = page;
    await loadPage(page);
  }

  $effect(() => {
    tableName = sheet ? sheet.replaceAll(" ", "_") : "";
  });

  $effect(() => {
    sheet;
    currentPage = 0;
    rows = [];
    totalRows = 0;
    headerRowInput = 1;
    appliedHeaderRow = 0;
    skipRows.reset();
    columnMeta = [];
    untrack(() => {
      loadPage(0);
    });
  });
</script>

{#if rows.length > 0}
  <div class="m-2 flex items-center justify-between gap-4">
    {#if sheetAction === "create"}
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
            {#each dbTables as t}
              <option value={t}>{t}</option>
            {/each}
          </select>
        {/if}
      </div>
    {:else}
      <div></div>
    {/if}
    <SheetFilters
      {filePath}
      {sheet}
      bind:headerRowInput
      {appliedHeaderRow}
      {skipRows}
      onapply={applyFilters}
    />
  </div>

  <div class="mt-2 overflow-x-auto">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          {#each rows[0] as _, i}
            <Table.Head class="border align-top bg-gray-100 dark:bg-gray-900">
              <ColumnTypeHeader meta={columnMeta[i]} />
            </Table.Head>
          {/each}
        </Table.Row>
        <Table.Row>
          {#each rows[0] as cell}
            <Table.Head
              class="border whitespace-nowrap bg-gray-50 dark:bg-gray-950 font-semibold"
              >{cell}</Table.Head
            >
          {/each}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each rows.slice(1) as row}
          <Table.Row>
            {#each row as cell}
              <Table.Cell class="whitespace-nowrap border">{cell}</Table.Cell>
            {/each}
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
  <div class="pr-2 float-right">
    <Paging {currentPage} {totalPages} {totalRows} onpage={goToPage} />
  </div>
{/if}

<ConfirmClearSkipRows
  bind:open={confirmDialogOpen}
  onconfirm={() => commitFilters(pendingHeaderRow)}
/>
