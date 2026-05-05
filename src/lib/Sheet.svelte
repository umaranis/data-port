<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import ConfirmClearSkipRows from "$lib/ConfirmClearSkipRows.svelte";
  import SheetFilters from "$lib/SheetFilters.svelte";
  import { type ColumnMeta } from "$lib/pgTypes";
  import { SkipRows } from "$lib/SkipRows.svelte";
  import { untrack } from "svelte";
  import { type SheetAction } from "$lib/Workbook.svelte";
  import SheetActionOptions from "$lib/SheetActionOptions.svelte";
  import SheetTableMapping from "$lib/SheetTableMapping.svelte";
  import SheetPreview from "$lib/SheetPreview.svelte";

  const PAGE_SIZE = 50;

  type Props = {
    filePath: string | null;
    sheet: string | null;
    sheetAction: SheetAction;
    dbTables: string[];
    savedConnString?: string | null;
    view?: "data" | "mapping";
  };

  let {
    filePath,
    sheet,
    sheetAction,
    dbTables,
    savedConnString,
    view = "data",
  }: Props = $props();

  let tableName = $state("");

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

  function applyInferredTypes(types: ColumnMeta[]) {
    columnMeta = types;
  }

  $effect(() => {
    tableName = sheet ? sheet.toLocaleLowerCase().replaceAll(" ", "_") : "";
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
    <SheetActionOptions
      {sheetAction}
      {dbTables}
      bind:tableName
      {filePath}
      {sheet}
      headerRow={appliedHeaderRow}
      skipRows={skipRows.applied}
      columnHeaders={rows[0] ?? []}
      {columnMeta}
      {savedConnString}
      oninfer={applyInferredTypes}
    />
    <SheetFilters
      {filePath}
      {sheet}
      bind:headerRowInput
      {appliedHeaderRow}
      {skipRows}
      onapply={applyFilters}
    />
  </div>

  {#if view === "mapping"}
    <SheetTableMapping columnHeaders={rows[0] ?? []} {columnMeta} />
  {:else}
    <SheetPreview
      {rows}
      {columnMeta}
      {currentPage}
      {totalPages}
      {totalRows}
      onpage={goToPage}
    />
  {/if}
{/if}

<ConfirmClearSkipRows
  bind:open={confirmDialogOpen}
  onconfirm={() => commitFilters(pendingHeaderRow)}
/>
