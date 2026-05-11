<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import type { Project } from "$lib/model/projectTypes";

  type Props = {
    open: boolean;
    projectName: string;
    getProject: () => Project;
    onsaved: (name: string) => void;
  };

  let {
    open = $bindable(),
    projectName,
    getProject,
    onsaved,
  }: Props = $props();

  let nameInput = $state("");
  let error = $state<string | null>(null);
  let saving = $state(false);

  $effect(() => {
    if (open) {
      nameInput = projectName;
      error = null;
    }
  });

  async function save() {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      error = "Project name is required.";
      return;
    }
    saving = true;
    error = null;
    try {
      const project: Project = { ...getProject(), name: trimmed };
      await invoke("save_project", { name: trimmed, payload: project });
      onsaved(trimmed);
      open = false;
    } catch (e) {
      error = String(e);
    } finally {
      saving = false;
    }
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Save project</AlertDialog.Title>
      <AlertDialog.Description>
        Give this project a name. It will be saved locally and can be loaded
        later.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <div class="px-1 py-2">
      <input
        type="text"
        bind:value={nameInput}
        onkeydown={(e) => e.key === "Enter" && save()}
        placeholder="Project name"
        class="w-full border rounded px-2 py-1 text-sm"
      />
      {#if error}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      {/if}
    </div>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
