<script lang="ts">
  type Props = {
    currentPage: number;
    totalPages: number;
    totalRows: number;
    onpage: (page: number) => void;
  };

  let { currentPage, totalPages, totalRows, onpage }: Props = $props();
</script>

{#if totalRows > 0}
  <div class="flex items-center gap-3 mt-3 mb-6">
    <button
      onclick={() => onpage(currentPage - 1)}
      disabled={currentPage === 0}
      class="px-3 py-1 border rounded disabled:opacity-40"
    >
      &larr; Prev
    </button>
    <span class="text-sm">
      Page {currentPage + 1} of {totalPages}
    </span>
    <button
      onclick={() => onpage(currentPage + 1)}
      disabled={currentPage >= totalPages - 1}
      class="px-3 py-1 border rounded disabled:opacity-40"
    >
      Next &rarr;
    </button>
    <span class="text-sm text-gray-500">({totalRows} rows total)</span>
  </div>
{/if}
