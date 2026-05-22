<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import type { DbColumn } from "./model/pgTypes";
  import type { SheetClass } from "./model/SheetClass.svelte";
  import type { SheetColumn } from "./model/SheetColumnClass.svelte";
  import SheetMappingRow from "./SheetMappingRow.svelte";

  type Props = { sheet: SheetClass };
  let { sheet }: Props = $props();

  export type SheetColumnForMapping =
    | SheetColumn
    | ({
        type: "unmapped";
      } & DbColumn);

  const columnMap = $derived.by(() => {
    return new Map(sheet.columns.map((c) => [c.dbColName, c]));
  });
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
            >DB Column</Table.Head
          >
          <Table.Head
            class="border bg-gray-100 dark:bg-gray-900 whitespace-nowrap"
            >Source</Table.Head
          >
          <Table.Head class="border bg-gray-100 dark:bg-gray-900"
            >Column Mapping</Table.Head
          >
          <Table.Head
            class="border bg-gray-100 dark:bg-gray-900 text-center w-12"
            >Excl.</Table.Head
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
            <SheetMappingRow index={i + 1} {column} {sheet} />
          {/each}
        {:else}
          {#each sheet.dbColumns as dbCol, i}
            {@const column = columnMap.get(dbCol.dbColName) ?? {
              dbColName: dbCol.dbColName,
              dataType: dbCol.dataType,
              length: dbCol.length,
              precision: dbCol.precision,
              scale: dbCol.scale,
              type: "unmapped",
            }}
            <SheetMappingRow index={i + 1} {column} {sheet} />
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
