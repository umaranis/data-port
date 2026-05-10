<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import FileSelector from "$lib/FileSelector.svelte";
  import ClearCache from "$lib/ClearCache.svelte";
  import PgConnect from "$lib/PgConnect.svelte";
  import Workbook from "$lib/Workbook.svelte";
  import ThemeToggle from "$lib/ThemeToggle.svelte";
  import { WorkbookClass } from "$lib/model/WorkbookClass.svelte";
  import { DatabaseClass } from "$lib/model/DatabaseClass.svelte";
  import { setDatabaseContext } from "$lib/model/databaseContext";

  let filePath = $state<string | null>(null);
  let workbook = $state<WorkbookClass | null>(null);
  let database = new DatabaseClass();
  setDatabaseContext(database);

  async function onFileLoad(fp: string) {
    filePath = fp;
    await invoke("clear_cache");
    if (filePath) {
      workbook = new WorkbookClass(filePath);
    }
  }

  async function onConnect(cs: string) {
    database.connectionString = cs;
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
    {#if database.connectionString}
      <code
        class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 break-all"
        >{database.connectionString}</code
      >
    {/if}
  </div>
  {#if workbook}
    <Workbook {workbook} />
  {/if}
</main>
