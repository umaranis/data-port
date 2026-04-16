<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import FileSelector from "$lib/FileSelector.svelte";
  import Workbook from "$lib/Workbook.svelte";
  import Sheet from "$lib/Sheet.svelte";

  const PAGE_SIZE = 50;

  let filePath = $state<string | null>(null);
  let sheets = $state<string[]>([]);
  let selectedSheet = $state<string | null>(null);
  let rows = $state<string[][]>([]);
  let currentPage = $state(0);
  let totalRows = $state(0);

  let totalPages = $derived(Math.max(1, Math.ceil(totalRows / PAGE_SIZE)));

  function handleLoad(fp: string, sh: string[]) {
    filePath = fp;
    sheets = sh;
    selectedSheet = null;
    rows = [];
    currentPage = 0;
    totalRows = 0;
  }

  async function loadPage(sheet: string, page: number) {
    const result = await invoke<{ rows: string[][]; total_rows: number }>(
      "get_sheet_rows_paged",
      { path: filePath, sheet, page, pageSize: PAGE_SIZE }
    );
    rows = result.rows;
    totalRows = result.total_rows;
  }

  async function handleSelectSheet(sheet: string) {
    selectedSheet = sheet;
    currentPage = 0;
    await loadPage(sheet, 0);
  }

  async function goToPage(page: number) {
    if (!selectedSheet || page < 0 || page >= totalPages) return;
    currentPage = page;
    await loadPage(selectedSheet, page);
  }
</script>

<main class="flex flex-col items-left pt-[10vh] px-4">
  <h1 class="text-2xl font-bold mb-6">Data Port</h1>
  <FileSelector onload={handleLoad} />
  {#if filePath && sheets.length > 0}
    <Workbook
      {filePath}
      {sheets}
      {selectedSheet}
      onselect={handleSelectSheet}
    />
    <Sheet {rows} />
    {#if totalRows > 0}
      <div class="flex items-center gap-3 mt-3 mb-6">
        <button
          onclick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 0}
          class="px-3 py-1 border rounded disabled:opacity-40"
        >
          &larr; Prev
        </button>
        <span class="text-sm">
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          onclick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          class="px-3 py-1 border rounded disabled:opacity-40"
        >
          Next &rarr;
        </button>
        <span class="text-sm text-gray-500">({totalRows} rows total)</span>
      </div>
    {/if}
  {/if}
</main>
