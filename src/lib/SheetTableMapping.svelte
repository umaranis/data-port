<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import type { SheetClass } from "./model/SheetClass.svelte";
  import type { SheetMappingClass } from "./model/SheetMappingClass.svelte";
  import SheetMappingRow from "./SheetMappingRow.svelte";

  type Props = { sheet: SheetClass; mapping: SheetMappingClass };
  let { sheet, mapping }: Props = $props();
</script>

{#if mapping.columns.length > 0}
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
        {#each mapping.columns as cm, i (i)}
          <SheetMappingRow index={i + 1} {cm} {sheet} {mapping} />
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
