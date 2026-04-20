<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import * as Table from "$lib/components/ui/table";
  import Paging from "$lib/Paging.svelte";
  import SheetFilters from "$lib/SheetFilters.svelte";
  import { type ColumnMeta } from "$lib/pgTypes";
  import { SkipRows } from "$lib/SkipRows.svelte";
  import { untrack } from "svelte";
  import ColumnTypeHeader from "./ColumnTypeHeader.svelte";

  const PAGE_SIZE = 50;

  type Props = {
    filePath: string | null;
    sheet: string | null;
  };

  let { filePath, sheet }: Props = $props();

  let rows = $state<string[][]>([]);
  let currentPage = $state(0);
  let totalRows = $state(0);

  let headerRowInput = $state(1);
  let appliedHeaderRow = $state(0);

  const skipRows = new SkipRows();

  let columnMeta = $state<ColumnMeta[]>([]);

  let totalPages = $derived(Math.max(1, Math.ceil(totalRows / PAGE_SIZE)));

  function freshMeta(count: number): ColumnMeta[] {
    return Array.from({ length: count }, () => ({ type: "text" }));
  }

  function applyFilters() {
    appliedHeaderRow = Math.max(0, headerRowInput - 1);
    skipRows.apply();
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
  <SheetFilters
    {filePath}
    {sheet}
    bind:headerRowInput
    {appliedHeaderRow}
    {skipRows}
    onapply={applyFilters}
  />
  <div class="mt-2 overflow-x-auto">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          {#each rows[0] as _, i}
            <Table.Head class="border align-top bg-gray-300 dark:bg-gray-700">
              <ColumnTypeHeader meta={columnMeta[i]} />
            </Table.Head>
          {/each}
        </Table.Row>
        <Table.Row>
          {#each rows[0] as cell}
            <Table.Head
              class="border whitespace-nowrap bg-blue-300 dark:bg-blue-700 font-semibold"
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
  <Paging {currentPage} {totalPages} {totalRows} onpage={goToPage} />
{/if}
