<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import Paging from "$lib/Paging.svelte";
  import ColumnTypeHeader from "$lib/ColumnTypeHeader.svelte";
  import { type ColumnMeta } from "$lib/pgTypes";

  type Props = {
    rows: string[][];
    columnMeta: ColumnMeta[];
    currentPage: number;
    totalPages: number;
    totalRows: number;
    onpage: (page: number) => void;
  };

  let { rows, columnMeta, currentPage, totalPages, totalRows, onpage }: Props = $props();
</script>

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
          <Table.Head class="border whitespace-nowrap bg-gray-50 dark:bg-gray-950 font-semibold"
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
  <Paging {currentPage} {totalPages} {totalRows} {onpage} />
</div>
