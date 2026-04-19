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

  let totalPages = $derived(Math.max(1, Math.ceil(totalRows / PAGE_SIZE)));

  async function loadPage(page: number) {
    if (!filePath || !sheet) return;
    const result = await invoke<{ rows: string[][]; total_rows: number }>(
      "get_sheet_rows_paged",
      { path: filePath, sheet, page, pageSize: PAGE_SIZE },
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
    // Reset and load whenever the sheet selection changes
    sheet;
    currentPage = 0;
    rows = [];
    totalRows = 0;
    untrack(() => {
      loadPage(0);
    });
  });
</script>

{#if rows.length > 0}
  <div class="mt-4 overflow-x-auto">
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
