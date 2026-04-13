<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import FileSelector from "$lib/FileSelector.svelte";
  import Workbook from "$lib/Workbook.svelte";
  import Sheet from "$lib/Sheet.svelte";

  let filePath = $state<string | null>(null);
  let sheets = $state<string[]>([]);
  let selectedSheet = $state<string | null>(null);
  let rows = $state<string[][]>([]);

  function handleLoad(fp: string, sh: string[]) {
    filePath = fp;
    sheets = sh;
    selectedSheet = null;
    rows = [];
  }

  async function handleSelectSheet(sheet: string) {
    selectedSheet = sheet;
    rows = await invoke<string[][]>("get_sheet_rows", {
      path: filePath,
      sheet,
    });
  }
</script>

<main class="flex flex-col items-center pt-[10vh] px-4">
  <h1 class="text-2xl font-bold mb-6">Data Port</h1>
  <FileSelector onload={handleLoad} />
  {#if filePath && sheets.length > 0}
    <Workbook
      {filePath}
      {sheets}
      {selectedSheet}
      onselect={handleSelectSheet}
    />
    <Sheet {rows} />
  {/if}
</main>
