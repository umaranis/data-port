<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import SheetFilters from "$lib/SheetFilters.svelte";
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

  let rows = $state<string[][]>([]);
  let currentPage = $state(0);
  let totalRows = $state(0);

  let totalPages = $derived(Math.max(1, Math.ceil(totalRows / PAGE_SIZE)));

  function freshMeta(count: number) {
    return Array.from({ length: count }, () => ({ type: "text" as const }));
  }

  async function loadHeader() {
    if (!filePath || !sheet) return;
    sheet.headers = await invoke<string[]>("get_sheet_header", {
      path: filePath,
      sheet: sheet.name,
      headerRow: sheet.headerRow,
    });
    if (sheet.columnMeta.length !== sheet.headers.length) {
      sheet.columnMeta = freshMeta(sheet.headers.length);
    }
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
  }

  async function goToPage(page: number) {
    if (page < 0 || page >= totalPages) return;
    currentPage = page;
    await loadPage(page);
  }

  function applyInferredTypes(types: typeof sheet.columnMeta) {
    sheet.columnMeta = types;
  }

  $effect(() => {
    sheet;
    currentPage = 0;
    rows = [];
    totalRows = 0;
    untrack(() => {
      loadHeader();
      loadPage(0);
    });
  });
</script>

{#if sheet.headers.length > 0}
  <div class="m-2 flex items-center justify-between gap-4">
    <SheetActionOptions
      {sheet}
      {dbTables}
      {filePath}
      {savedConnString}
      oninfer={applyInferredTypes}
    />
    <SheetFilters
      {filePath}
      {sheet}
      oncommit={() => {
        currentPage = 0;
        loadHeader();
        loadPage(0);
      }}
    />
  </div>

  {#if view === "mapping"}
    <SheetTableMapping
      columnHeaders={sheet.headers}
      columnMeta={sheet.columnMeta}
    />
  {:else}
    <SheetPreview
      {rows}
      columnHeaders={sheet.headers}
      columnMeta={sheet.columnMeta}
      {currentPage}
      {totalPages}
      {totalRows}
      onpage={goToPage}
    />
  {/if}
{/if}
