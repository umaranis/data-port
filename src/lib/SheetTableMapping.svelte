<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import ColumnTypeHeader from "./ColumnTypeHeader.svelte";
  import { type ColumnMeta } from "$lib/model/pgTypes";
  import type { SheetClass } from "./model/SheetClass.svelte";

  type Props = {
    sheet: SheetClass;
  };

  let { sheet }: Props = $props();
</script>

{#if sheet.columns.length > 0}
  <div class="mt-2 overflow-x-auto">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head
            class="border bg-gray-100 dark:bg-gray-900 w-10 text-center"
            >#</Table.Head
          >
          <Table.Head class="border bg-gray-100 dark:bg-gray-900"
            >Sheet Column</Table.Head
          >
          <Table.Head class="border bg-gray-100 dark:bg-gray-900"
            >DB Column / Type</Table.Head
          >
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each sheet.columns as column, i}
          {#if column.type === "sheet"}
            <Table.Row>
              <Table.Cell
                class="border text-center text-xs text-muted-foreground"
                >{i + 1}</Table.Cell
              >
              <Table.Cell class="border font-medium whitespace-nowrap"
                >{column.header}</Table.Cell
              >
              <Table.Cell class="border">
                <ColumnTypeHeader meta={column.dbColumn} />
              </Table.Cell>
            </Table.Row>
          {/if}
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
