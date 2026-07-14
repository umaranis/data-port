<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import Paging from "$lib/Paging.svelte";
  import type { SheetDataClass } from "./model/SheetDataClass.svelte";

  type Props = {
    data: SheetDataClass;
  };

  let { data }: Props = $props();
</script>

<div class="mt-2 overflow-x-auto">
  <Table.Root>
    <Table.Header>
      <Table.Row>
        {#each data.sheet.columns as col}
          <Table.Head
            class="border whitespace-nowrap bg-gray-50 dark:bg-gray-950 font-semibold"
            >{col.header}</Table.Head
          >
        {/each}
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each data.rows as row}
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
  <Paging {data} />
</div>
