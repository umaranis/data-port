<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import * as Table from "$lib/components/ui/table";
  import Paging from "$lib/Paging.svelte";
  import { untrack } from "svelte";

  const PAGE_SIZE = 50;

  const PG_TYPES = [
    "text",
    "varchar",
    "integer",
    "bigint",
    "numeric",
    "boolean",
    "date",
    "timestamp",
    "timestamptz",
    "double precision",
    "jsonb",
    "uuid",
  ] as const;

  type PgType = (typeof PG_TYPES)[number];

  // Which modifiers each type accepts
  const TYPE_MODIFIERS: Record<
    PgType,
    { length?: true; precision?: true; scale?: true }
  > = {
    text: {},
    varchar: { length: true },
    integer: {},
    bigint: {},
    numeric: { precision: true, scale: true },
    boolean: {},
    date: {},
    timestamp: { precision: true },
    timestamptz: { precision: true },
    "double precision": {},
    jsonb: {},
    uuid: {},
  };

  type ColumnMeta = {
    type: PgType;
    length?: number;
    precision?: number;
    scale?: number;
  };

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

  let skipRowsInput = $state("");
  let appliedSkipRows = $state<number[]>([]);

  let columnMeta = $state<ColumnMeta[]>([]);

  let totalPages = $derived(Math.max(1, Math.ceil(totalRows / PAGE_SIZE)));

  function freshMeta(count: number): ColumnMeta[] {
    return Array.from({ length: count }, () => ({ type: "text" }));
  }

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
    skipRowsInput = "";
    appliedSkipRows = [];
    columnMeta = [];
    untrack(() => {
      loadPage(0);
    });
  });
</script>

{#if rows.length > 0}
  <div class="mt-4 flex items-center gap-2 flex-wrap">
    <label for="header-row" class="text-sm whitespace-nowrap">
      Header row:
      <span
        title="Rows before the header row are skipped"
        class="cursor-help text-gray-400 hover:text-gray-600">ⓘ</span
      >
    </label>
    <input
      id="header-row"
      type="number"
      min="1"
      bind:value={headerRowInput}
      onkeydown={(e) => e.key === "Enter" && applyFilters()}
      class="border rounded px-2 py-1 text-sm w-16"
    />
    <label for="skip-rows" class="text-sm whitespace-nowrap ml-2"
      >Skip rows:</label
    >
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
          {#each rows[0] as cell, i}
            {@const modifiers = TYPE_MODIFIERS[columnMeta[i]?.type ?? "text"]}
            <Table.Head class="border align-top">
              <div class="flex flex-col gap-1 py-1 min-w-[110px]">
                <span class="whitespace-nowrap">{cell}</span>
                <select
                  bind:value={columnMeta[i].type}
                  class="text-xs font-normal border rounded px-1 py-0.5 bg-white dark:bg-gray-800 dark:border-gray-600 cursor-pointer"
                >
                  {#each PG_TYPES as type}
                    <option value={type}>{type}</option>
                  {/each}
                </select>
                {#if modifiers.length}
                  <input
                    type="number"
                    min="1"
                    bind:value={columnMeta[i].length}
                    placeholder="length"
                    class="text-xs font-normal border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
                  />
                {/if}
                {#if modifiers.precision}
                  <input
                    type="number"
                    min="1"
                    bind:value={columnMeta[i].precision}
                    placeholder="precision"
                    class="text-xs font-normal border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
                  />
                {/if}
                {#if modifiers.scale}
                  <input
                    type="number"
                    min="0"
                    bind:value={columnMeta[i].scale}
                    placeholder="scale"
                    class="text-xs font-normal border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
                  />
                {/if}
              </div>
            </Table.Head>
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
