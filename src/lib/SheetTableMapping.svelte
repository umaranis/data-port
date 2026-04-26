<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import ColumnTypeHeader from "./ColumnTypeHeader.svelte";
  import { type ColumnMeta } from "$lib/pgTypes";

  type Props = {
    columnHeaders: string[];
    columnMeta: ColumnMeta[];
  };

  let { columnHeaders, columnMeta }: Props = $props();
</script>

{#if columnHeaders.length > 0}
  <div class="mt-2 overflow-x-auto">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="border bg-gray-100 dark:bg-gray-900 w-10 text-center">#</Table.Head>
          <Table.Head class="border bg-gray-100 dark:bg-gray-900">Sheet Column</Table.Head>
          <Table.Head class="border bg-gray-100 dark:bg-gray-900">DB Column / Type</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each columnHeaders as header, i}
          <Table.Row>
            <Table.Cell class="border text-center text-xs text-muted-foreground">{i + 1}</Table.Cell>
            <Table.Cell class="border font-medium whitespace-nowrap">{header}</Table.Cell>
            <Table.Cell class="border">
              <ColumnTypeHeader meta={columnMeta[i]} />
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
