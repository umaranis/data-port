<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import FileSelector from "$lib/FileSelector.svelte";
  import ClearCache from "$lib/ClearCache.svelte";
  import PgConnect from "$lib/PgConnect.svelte";
  import Db2Connect from "$lib/Db2Connect.svelte";
  import Workbook from "$lib/Workbook.svelte";
  import ThemeToggle from "$lib/ThemeToggle.svelte";
  import SaveProjectDialog from "$lib/SaveProjectDialog.svelte";
  import LoadProjectList from "$lib/LoadProjectList.svelte";
  import { WorkbookClass } from "$lib/model/WorkbookClass.svelte";
  import { DatabaseClass } from "$lib/model/DatabaseClass.svelte";
  import { setDatabaseContext } from "$lib/model/databaseContext";
  import { Button } from "$lib/components/ui/button";
  import type { Project } from "$lib/model/projectTypes";

  let workbook = $state<WorkbookClass | null>(null);
  let database = new DatabaseClass();
  setDatabaseContext(database);

  let projectName = $state("");
  let saveOpen = $state(false);
  let loadList = $state<LoadProjectList | null>(null);

  function currentProject(): Project {
    return {
      name: projectName,
      filePath: workbook?.filePath ?? "",
      dbType: database.dbType,
      connectionString: database.connectionString,
      sheets: workbook?.toSnapshot() ?? [],
    };
  }

  async function onFileLoad(fp: string) {
    await invoke("clear_cache");
    if (fp) {
      workbook = WorkbookClass.create(fp, database);
    }
  }

  async function onConnect(cs: string) {
    database.connectionString = cs;
  }

  function switchDbType(type: typeof database.dbType) {
    if (database.dbType === type) return;
    database.dbType = type;
    database.connectionString = null;
  }

  async function onLoadProject(project: Project) {
    projectName = project.name;
    await invoke("clear_cache");
    database.dbType = project.dbType ?? "postgres";
    database.connectionString = project.connectionString;
    workbook = await WorkbookClass.deserialize(project, database);
  }

  function onProjectSaved(name: string) {
    projectName = name;
    loadList?.refresh();
  }
</script>

<main class="flex flex-col items-left pt-[10vh] px-4">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold">
      Data Port{#if projectName}<span
          class="text-base font-normal text-gray-500 ml-2">— {projectName}</span
        >{/if}
    </h1>
    <div class="flex items-center gap-2">
      <LoadProjectList bind:this={loadList} onload={onLoadProject} />
      {#if workbook}
        <Button variant="outline" size="sm" onclick={() => (saveOpen = true)}>
          Save project
        </Button>
      {/if}
      <ThemeToggle />
    </div>
  </div>
  <div class="flex flex-row items-center gap-3">
    <FileSelector onload={onFileLoad} />
    <ClearCache />
  </div>
  <div class="mt-3 flex flex-row items-center gap-3">
    <div class="flex rounded-lg border overflow-hidden text-sm">
      <button
        class="px-3 py-1.5 transition-colors {database.dbType === 'postgres'
          ? 'bg-blue-600 text-white'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'}"
        onclick={() => switchDbType("postgres")}
      >
        PostgreSQL
      </button>
      <button
        class="px-3 py-1.5 border-l transition-colors {database.dbType === 'db2'
          ? 'bg-blue-600 text-white'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'}"
        onclick={() => switchDbType("db2")}
      >
        DB2
      </button>
    </div>

    {#if database.dbType === "postgres"}
      <PgConnect
        onconnect={onConnect}
        initialConnString={database.connectionString}
      />
    {:else}
      <Db2Connect
        onconnect={onConnect}
        initialConnString={database.connectionString}
      />
    {/if}

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

<SaveProjectDialog
  bind:open={saveOpen}
  {projectName}
  getProject={currentProject}
  onsaved={onProjectSaved}
/>
