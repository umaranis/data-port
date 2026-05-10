<script lang="ts">
  import type { SheetDataClass } from "./model/SheetDataClass.svelte";

  type Props = {
    data: SheetDataClass;
  };

  let { data }: Props = $props();
</script>

{#if data.totalRows !== undefined && data.totalRows > 0}
  <div class="flex items-center gap-3 mt-3 mb-6">
    <button
      onclick={() => data.loadPage(0)}
      disabled={data.currentPage === 0}
      class="px-3 py-1 border rounded disabled:opacity-40"
    >
      &laquo;
    </button>
    <button
      onclick={() => data.loadPage(data.currentPage - 1)}
      disabled={data.currentPage === 0}
      class="px-3 py-1 border rounded disabled:opacity-40"
    >
      &larr; Prev
    </button>
    <span class="text-sm">
      Page {data.currentPage + 1} of {data.totalPages}
    </span>
    <button
      onclick={() => data.loadPage(data.currentPage + 1)}
      disabled={data.totalPages === undefined ||
        data.currentPage >= data.totalPages - 1}
      class="px-3 py-1 border rounded disabled:opacity-40"
    >
      Next &rarr;
    </button>
    <button
      onclick={() => data.loadPage(data.totalPages! - 1)}
      disabled={data.totalPages === undefined ||
        data.currentPage >= data.totalPages - 1}
      class="px-3 py-1 border rounded disabled:opacity-40"
    >
      &raquo;
    </button>
    <span class="text-sm text-gray-500">({data.totalRows} rows total)</span>
  </div>
{/if}
