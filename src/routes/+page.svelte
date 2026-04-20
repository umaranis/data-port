<script lang="ts">
  import FileSelector from "$lib/FileSelector.svelte";
  import ClearCache from "$lib/ClearCache.svelte";
  import Workbook from "$lib/Workbook.svelte";

  let filePath = $state<string | null>(null);
</script>

<main class="flex flex-col items-left pt-[10vh] px-4">
  <h1 class="text-2xl font-bold mb-6">Data Port</h1>
  <div class="flex flex-row items-center gap-3">
    <FileSelector onload={(fp) => (filePath = fp)} />
    <ClearCache />
  </div>
  <Workbook {filePath} />
</main>
