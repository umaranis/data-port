<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import * as Tabs from "$lib/components/ui/tabs";
  import Sheet from "$lib/Sheet.svelte";

  export type SheetAction = "create" | "append" | "recreate" | "skip";

  const SHEET_ACTIONS: { value: SheetAction; label: string }[] = [
    { value: "create", label: "create table" },
    { value: "append", label: "append table" },
    { value: "recreate", label: "re-create table" },
    { value: "skip", label: "skip sheet" },
  ];

  type Props = {
    filePath: string | null;
  };

  let { filePath }: Props = $props();

  let sheets = $state.raw<string[]>([]);
  let selectedSheet = $state<string | null>(null);
  let sheetActions = $state<Record<string, SheetAction>>({});
  let error = $state<string | null>(null);

  $effect(() => {
    sheets = [];
    selectedSheet = null;
    sheetActions = {};
    error = null;
    if (!filePath) return;
    invoke<string[]>("get_sheets", { path: filePath })
      .then((s) => {
        sheets = s;
        selectedSheet = s[0] ?? null;
        sheetActions = Object.fromEntries(
          s.map((name) => [name, "create" as SheetAction]),
        );
      })
      .catch((e) => (error = String(e)));
  });
</script>

{#if error}
  <p class="mt-4 text-red-600 dark:text-red-400">{error}</p>
{/if}

{#if sheets.length > 0}
  <div class="mt-4 w-full border rounded-lg p-2">
    <Tabs.Root
      value={selectedSheet ?? undefined}
      onValueChange={(s) => (selectedSheet = s)}
    >
      <Tabs.List class="flex flex-wrap !h-auto gap-y-1 gap-x-3">
        <div class="text-xs pl-2">Sheets:</div>
        {#each sheets as sheet, i}
          {#if i > 0}
            <div class="w-px self-stretch bg-border"></div>
          {/if}
          <div class="flex items-center">
            <Tabs.Trigger value={sheet} class="py-3 px-4">
              {sheet}
              <select
                bind:value={sheetActions[sheet]}
                onclick={(e) => e.stopPropagation()}
                class="ml-1 text-xs border rounded px-1 py-0.5 dark:bg-gray-800 dark:border-gray-600 cursor-pointer"
              >
                {#each SHEET_ACTIONS as action}
                  <option value={action.value}>{action.label}</option>
                {/each}
              </select>
            </Tabs.Trigger>
          </div>
        {/each}
      </Tabs.List>
    </Tabs.Root>
    <div class="mt-0 border rounded-lg">
      <Sheet {filePath} sheet={selectedSheet} />
    </div>
  </div>
{/if}
