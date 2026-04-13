<script lang="ts">
  import FileSelector from "$lib/FileSelector.svelte";
  import Workbook from "$lib/Workbook.svelte";

  let filePath = $state<string | null>(null);
  let sheets = $state<string[]>([]);

  function handleLoad(fp: string, sh: string[]) {
    filePath = fp;
    sheets = sh;
  }
</script>

<main class="flex flex-col items-center pt-[10vh] px-4">
  <h1 class="text-2xl font-bold mb-6">Data Port</h1>
  <FileSelector onload={handleLoad} />
  {#if filePath && sheets.length > 0}
    <Workbook {filePath} {sheets} />
  {/if}
</main>
