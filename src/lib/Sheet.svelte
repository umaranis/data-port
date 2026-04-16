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
{/if}
