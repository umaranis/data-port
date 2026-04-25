<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import FileSelector from "$lib/FileSelector.svelte";
  import ClearCache from "$lib/ClearCache.svelte";
  import PgConnect from "$lib/PgConnect.svelte";
  import Workbook from "$lib/Workbook.svelte";
  import ThemeToggle from "$lib/ThemeToggle.svelte";

  let filePath = $state<string | null>(null);
  let pgConnString = $state<string | null>(null);
  let dbTables = $state<string[]>([]);

  async function onFileLoad(fp: string) {
    filePath = fp;
    await invoke("clear_cache");
  }

  async function onConnect(cs: string) {
    pgConnString = cs;
    dbTables = await invoke<string[]>("pg_get_tables", { connString: cs });
  }
</script>

<main class="flex flex-col items-left pt-[10vh] px-4">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold">Data Port</h1>
    <ThemeToggle />
  </div>
  <div class="flex flex-row items-center gap-3">
    <FileSelector onload={onFileLoad} />
    <ClearCache />
  </div>
  <div class="mt-3 flex flex-row items-center gap-3">
    <PgConnect onconnect={onConnect} />
    {#if pgConnString}
      <code
        class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 break-all"
        >{pgConnString}</code
      >
    {/if}
  </div>
  <Workbook {filePath} {dbTables} connString={pgConnString} />
</main>
