<script lang="ts">
  import * as Table from "$lib/components/ui/table";

  type Props = {
    rows: string[][];
  };

  let { rows }: Props = $props();
</script>

{#if rows.length > 0}
  <div class="mt-4 overflow-x-auto">
    <Table.Root>
      <Table.Body>
        {#each rows as row}
          <Table.Row>
            {#each row as cell}
              <Table.Cell class="whitespace-nowrap border">{cell}</Table.Cell>
            {/each}
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
