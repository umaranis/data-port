<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import FileSelector from "$lib/FileSelector.svelte";
  import ClearCache from "$lib/ClearCache.svelte";
  import PgConnect from "$lib/PgConnect.svelte";
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

  async function onLoadProject(project: Project) {
    projectName = project.name;
    await invoke("clear_cache");
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
    <PgConnect onconnect={onConnect} initialConnString={database.connectionString} />
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
