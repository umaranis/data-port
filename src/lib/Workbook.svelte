<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import * as Tabs from "$lib/components/ui/tabs";
  import * as Select from "$lib/components/ui/select";
  import Sheet from "$lib/Sheet.svelte";
  import { WorkbookClass, SheetClass, type SheetAction } from "./WorkbookClass.svelte.js";

  const SHEET_ACTIONS: { value: SheetAction; label: string }[] = [
    { value: "create", label: "create table" },
    { value: "append", label: "append table" },
    { value: "recreate", label: "re-create table" },
    { value: "skip", label: "skip sheet" },
  ];

  type Props = {
    filePath: string | null;
    dbTables: string[];
    connString?: string | null;
  };

  let { filePath, dbTables, connString }: Props = $props();

  const wb = new WorkbookClass();
  let error = $state<string | null>(null);
  let view = $state<"data" | "mapping">("data");

  $effect(() => {
    wb.sheets = [];
    wb.selectedSheet = null;
    error = null;
    if (!filePath) return;
    invoke<string[]>("get_sheets", { path: filePath })
      .then((names) => {
        wb.sheets = names.map((n) => new SheetClass(n));
        wb.selectedSheet = wb.sheets[0] ?? null;
      })
      .catch((e) => (error = String(e)));
  });
</script>

{#if error}
  <p class="mt-4 text-red-600 dark:text-red-400">{error}</p>
{/if}

{#if wb.sheets.length > 0}
  <div class="mt-4 w-full border rounded-lg p-2">
  <div class="flex flex-row">
    <Tabs.Root
      value={wb.selectedSheet?.name ?? undefined}
      onValueChange={(s) => (wb.selectedSheet = wb.sheets.find((sh) => sh.name === s) ?? null)}
    >
      <Tabs.List class="flex flex-wrap h-auto! gap-y-1 gap-x-3">
        <div class="text-xs pl-2">Sheets:</div>
        {#each wb.sheets as sheet, i}
          {#if i > 0}
            <div class="w-px self-stretch bg-border"></div>
          {/if}
          <div class="flex items-center">
            <Tabs.Trigger value={sheet.name} class="py-2 px-4">
              {sheet.name}
              <Select.Root
                type="single"
                value={sheet.action}
                onValueChange={(v) => {
                  sheet.action = v as SheetAction;
                }}
              >
                <Select.Trigger
                  size="sm"
                  class="ml-1 text-xs h-auto py-0.5 font-normal"
                  onclick={(e) => e.stopPropagation()}
                >
                  {SHEET_ACTIONS.find((a) => a.value === sheet.action)?.label}
                </Select.Trigger>
                <Select.Content>
                  {#each SHEET_ACTIONS as action}
                    <Select.Item value={action.value} class="text-xs">
                      {action.label}
                    </Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </Tabs.Trigger>
          </div>
        {/each}
      </Tabs.List>
    </Tabs.Root>
    <div class="mt-2 flex px-1 ml-auto justify-center">
      <div class="inline-flex rounded-md border text-xs overflow-hidden">
        <button
          class="px-3 py-1 {view === 'data' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
          onclick={() => (view = "data")}
        >Data</button>
        <div class="w-px bg-border"></div>
        <button
          class="px-3 py-1 {view === 'mapping' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
          onclick={() => (view = "mapping")}
        >Mapping</button>
      </div>
    </div>
  </div>
  <div class="mt-1 border rounded-lg">
    {#if wb.selectedSheet}
    <Sheet
      {filePath}
      sheet={wb.selectedSheet}
      {dbTables}
      savedConnString={connString}
      {view}
    />
    {/if}
  </div>
  </div>
{/if}
