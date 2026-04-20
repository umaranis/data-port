<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import * as Table from "$lib/components/ui/table";
  import Paging from "$lib/Paging.svelte";
  import { untrack } from "svelte";

  const PAGE_SIZE = 50;

  type Props = {
    filePath: string | null;
    sheet: string | null;
  };

  let { filePath, sheet }: Props = $props();

  let rows = $state<string[][]>([]);
  let currentPage = $state(0);
  let totalRows = $state(0);

  let headerRowInput = $state(1);           // 1-indexed, shown in UI
  let appliedHeaderRow = $state(0);         // 0-indexed, sent to backend

  let skipRowsInput = $state("");
  let appliedSkipRows = $state<number[]>([]);

  let totalPages = $derived(Math.max(1, Math.ceil(totalRows / PAGE_SIZE)));

  function parseSkipRows(input: string): number[] {
    const result = new Set<number>();
    for (const part of input.split(",")) {
      const trimmed = part.trim();
      const range = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) {
        const start = parseInt(range[1]);
        const end = parseInt(range[2]);
        for (let i = start; i <= end; i++) result.add(i);
      } else if (/^\d+$/.test(trimmed)) {
        result.add(parseInt(trimmed));
      }
    }
    return Array.from(result);
  }

  function applyFilters() {
    appliedHeaderRow = Math.max(0, headerRowInput - 1);
    appliedSkipRows = parseSkipRows(skipRowsInput);
    currentPage = 0;
    untrack(() => loadPage(0));
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
        skipRows: appliedSkipRows,
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

  $effect(() => {
    sheet;
    currentPage = 0;
    rows = [];
    totalRows = 0;
    headerRowInput = 1;
    appliedHeaderRow = 0;
    skipRowsInput = "";
    appliedSkipRows = [];
    untrack(() => {
      loadPage(0);
    });
  });
</script>

{#if rows.length > 0}
  <div class="mt-4 flex items-center gap-2 flex-wrap">
    <label for="header-row" class="text-sm whitespace-nowrap">Header row:</label>
    <input
      id="header-row"
      type="number"
      min="1"
      bind:value={headerRowInput}
      onkeydown={(e) => e.key === "Enter" && applyFilters()}
      class="border rounded px-2 py-1 text-sm w-16"
    />
    <label for="skip-rows" class="text-sm whitespace-nowrap ml-2">Skip rows:</label>
    <input
      id="skip-rows"
      type="text"
      bind:value={skipRowsInput}
      onkeydown={(e) => e.key === "Enter" && applyFilters()}
      placeholder="e.g. 1,3,5-10"
      class="border rounded px-2 py-1 text-sm w-48"
    />
    <button
      onclick={applyFilters}
      class="border rounded px-3 py-1 text-sm hover:bg-gray-100"
    >
      Apply
    </button>
    {#if appliedSkipRows.length > 0}
      <span class="text-sm text-gray-500">
        {appliedSkipRows.length} row{appliedSkipRows.length !== 1 ? "s" : ""} hidden
      </span>
    {/if}
  </div>
  <div class="mt-2 overflow-x-auto">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          {#each rows[0] as cell}
            <Table.Head class="whitespace-nowrap border">{cell}</Table.Head>
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
  <Paging {currentPage} {totalPages} {totalRows} onpage={goToPage} />
{/if}
