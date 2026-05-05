<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import SheetFilters from "$lib/SheetFilters.svelte";
  import { type ColumnMeta } from "$lib/pgTypes";
  import { untrack } from "svelte";
  import { SheetClass } from "$lib/WorkbookClass.svelte.js";
  import SheetActionOptions from "$lib/SheetActionOptions.svelte";
  import SheetTableMapping from "$lib/SheetTableMapping.svelte";
  import SheetPreview from "$lib/SheetPreview.svelte";

  const PAGE_SIZE = 50;

  type Props = {
    filePath: string | null;
    sheet: SheetClass;
    dbTables: string[];
    savedConnString?: string | null;
    view?: "data" | "mapping";
  };

  let {
    filePath,
    sheet,
    dbTables,
    savedConnString,
    view = "data",
  }: Props = $props();

  let tableName = $state("");

  let rows = $state<string[][]>([]);
  let currentPage = $state(0);
  let totalRows = $state(0);

  let columnMeta = $state<ColumnMeta[]>([]);

  let totalPages = $derived(Math.max(1, Math.ceil(totalRows / PAGE_SIZE)));

  function freshMeta(count: number): ColumnMeta[] {
    return Array.from({ length: count }, () => ({ type: "text" }));
  }

  async function loadPage(page: number) {
    if (!filePath || !sheet) return;
    const result = await invoke<{ rows: string[][]; total_rows: number }>(
      "get_sheet_rows_paged_filtered",
      {
        path: filePath,
        sheet: sheet.name,
        page,
        pageSize: PAGE_SIZE,
        headerRow: sheet.headerRow,
        skipRows: sheet.skipRows,
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
    tableName = sheet?.name
      ? sheet.name.toLocaleLowerCase().replaceAll(" ", "_")
      : "";
  });

  $effect(() => {
    sheet;
    currentPage = 0;
    rows = [];
    totalRows = 0;
    if (sheet) {
      sheet.headerRow = 0;
      sheet.skipRows = [];
    }
    columnMeta = [];
    untrack(() => {
      loadPage(0);
    });
  });
</script>

{#if rows.length > 0}
  <div class="m-2 flex items-center justify-between gap-4">
    <SheetActionOptions
      sheetAction={sheet?.action ?? "create"}
      {dbTables}
      bind:tableName
      {filePath}
      sheet={sheet?.name ?? null}
      headerRow={sheet.headerRow}
      skipRows={sheet.skipRows}
      columnHeaders={rows[0] ?? []}
      {columnMeta}
      {savedConnString}
      oninfer={applyInferredTypes}
    />
    <SheetFilters
      {filePath}
      {sheet}
      oncommit={() => { currentPage = 0; loadPage(0); }}
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
