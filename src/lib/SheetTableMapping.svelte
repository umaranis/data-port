<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import type { SheetClass } from "./model/SheetClass.svelte";
  import SheetMappingRow from "./SheetMappingRow.svelte";

  type Props = { sheet: SheetClass };
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
          <Table.Head
            class="border bg-gray-100 dark:bg-gray-900 whitespace-nowrap"
            >Col Type</Table.Head
          >
          <Table.Head class="border bg-gray-100 dark:bg-gray-900"
            >Config</Table.Head
          >
          <Table.Head
            class="border bg-gray-100 dark:bg-gray-900 text-center w-12"
            >Excl.</Table.Head
          >
          <Table.Head
            class="border bg-gray-100 dark:bg-gray-900 whitespace-nowrap"
            >DB Column</Table.Head
          >
          <Table.Head
            class="border bg-gray-100 dark:bg-gray-900 whitespace-nowrap"
            >DB Type</Table.Head
          >
          <Table.Head class="border bg-gray-100 dark:bg-gray-900 w-20"
            >Length</Table.Head
          >
          <Table.Head class="border bg-gray-100 dark:bg-gray-900 w-20"
            >Precision</Table.Head
          >
          <Table.Head class="border bg-gray-100 dark:bg-gray-900 w-20"
            >Scale</Table.Head
          >
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#if sheet.dbColumns === null}
          {#each sheet.columns as column, i}
            <SheetMappingRow
              index={i + 1}
              {column}
              dbColumns={sheet.dbColumns}
            />
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
