<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import * as Select from "$lib/components/ui/select";
  import type { Project } from "$lib/model/projectTypes";

  type Props = {
    onload: (project: Project) => void;
  };

  let { onload }: Props = $props();

  let projects = $state<string[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function refresh() {
    try {
      projects = await invoke<string[]>("list_projects");
    } catch (e) {
      error = String(e);
    }
  }

  async function loadProject(name: string) {
    if (!name) return;
    loading = true;
    error = null;
    try {
      const project = await invoke<Project>("load_project", { name });
      onload(project);
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    refresh();
  });

  export { refresh };
</script>

{#if projects.length > 0}
  <Select.Root
    type="single"
    disabled={loading}
    onValueChange={(v) => v && loadProject(v)}
  >
    <Select.Trigger class="text-sm h-8 w-40">Load project</Select.Trigger>
    <Select.Content>
      {#each projects as name}
        <Select.Item value={name} class="text-sm">{name}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
{/if}
{#if error}
  <p class="text-xs text-red-600 dark:text-red-400">{error}</p>
{/if}
