<script lang="ts">
  type Props = {
    rows: string[][];
  };

  let { rows }: Props = $props();
</script>

{#if rows.length > 0}
  <div class="mt-4 overflow-x-auto">
    <table class="text-sm border-collapse">
      <tbody>
        {#each rows as row, i}
          <tr class={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
            {#each row as cell}
              <td class="border border-gray-200 dark:border-gray-600 px-3 py-1 whitespace-nowrap">
                {cell}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
