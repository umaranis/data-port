<script lang="ts">
  import FileSelector from "$lib/FileSelector.svelte";
  import ClearCache from "$lib/ClearCache.svelte";
  import PgConnect from "$lib/PgConnect.svelte";
  import Workbook from "$lib/Workbook.svelte";

  let filePath = $state<string | null>(null);
  let pgConnString = $state<string | null>(null);
</script>

<main class="flex flex-col items-left pt-[10vh] px-4">
  <h1 class="text-2xl font-bold mb-6">Data Port</h1>
  <div class="flex flex-row items-center gap-3">
    <FileSelector onload={(fp) => (filePath = fp)} />
    <ClearCache />
  </div>
  <div class="mt-3 flex flex-row items-center gap-3">
    <PgConnect onconnect={(cs) => (pgConnString = cs)} />
    {#if pgConnString}
      <code class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 break-all">{pgConnString}</code>
    {/if}
  </div>
  <Workbook {filePath} />
</main>
