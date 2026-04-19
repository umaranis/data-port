<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import * as Tabs from "$lib/components/ui/tabs";
  import Sheet from "$lib/Sheet.svelte";

  type Props = {
    filePath: string | null;
  };

  let { filePath }: Props = $props();

  let sheets = $state.raw<string[]>([]);
  let selectedSheet = $state<string | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    sheets = [];
    selectedSheet = null;
    error = null;
    if (!filePath) return;
    invoke<string[]>("get_sheets", { path: filePath })
      .then((s) => {
        sheets = s;
        selectedSheet = s[0] ?? null;
      })
      .catch((e) => (error = String(e)));
  });
</script>

{#if error}
  <p class="mt-4 text-red-600 dark:text-red-400">{error}</p>
{/if}

{#if sheets.length > 0}
  <div class="mt-4 w-full max-w-3xl">
    <Tabs.Root
      value={selectedSheet ?? undefined}
      onValueChange={(s) => (selectedSheet = s)}
    >
      <Tabs.List>
        {#each sheets as sheet}
          <Tabs.Trigger value={sheet}>{sheet}</Tabs.Trigger>
        {/each}
      </Tabs.List>
    </Tabs.Root>
  </div>
  <Sheet {filePath} sheet={selectedSheet} />
{/if}
