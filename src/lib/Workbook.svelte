<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import * as Select from "$lib/components/ui/select";
  import Sheet from "$lib/Sheet.svelte";
  import { WorkbookClass } from "./model/WorkbookClass.svelte.js";

  import { type MappingAction } from "./model/mappingTypes";

  const SHEET_ACTIONS: { value: MappingAction; label: string }[] = [
    { value: "create", label: "create table" },
    { value: "append", label: "append table" },
    { value: "recreate", label: "re-create table" },
  ];

  type Props = {
    workbook: WorkbookClass;
  };

  let { workbook }: Props = $props();

  let error = $state<string | null>(null);
  let view = $state<"data" | "mapping">("data");
</script>

{#if error}
  <p class="mt-4 text-red-600 dark:text-red-400">{error}</p>
{/if}

{#if workbook.sheets.length > 0}
  <div class="mt-4 w-full border rounded-lg p-2">
    <div class="flex flex-row">
      <Tabs.Root
        value={workbook.selectedSheet?.name ?? undefined}
        onValueChange={(s) =>
          (workbook.selectedSheet =
            workbook.sheets.find((sh) => sh.name === s) ?? null)}
      >
        <Tabs.List class="flex flex-wrap h-auto! gap-y-1 gap-x-3">
          <div class="text-xs pl-2">Sheets:</div>
          {#each workbook.sheets as sheet, i}
            {#if i > 0}
              <div class="w-px self-stretch bg-border"></div>
            {/if}
            <div class="flex items-center">
              <Tabs.Trigger value={sheet.name} class="py-2 px-4">
                {sheet.name}
                <Select.Root
                  type="single"
                  value={sheet.selectedMapping.action}
                  onValueChange={async (value) => {
                    sheet.selectedMapping.setAction(value as MappingAction);
                  }}
                >
                  <Select.Trigger
                    size="sm"
                    class="ml-1 text-xs h-auto py-0.5 font-normal"
                    onclick={(e) => e.stopPropagation()}
                  >
                    {SHEET_ACTIONS.find(
                      (a) => a.value === sheet.selectedMapping.action,
                    )?.label}
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
            class="px-3 py-1 {view === 'data'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'}"
            onclick={() => (view = "data")}>Data</button
          >
          <div class="w-px bg-border"></div>
          <button
            class="px-3 py-1 {view === 'mapping'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'}"
            onclick={() => (view = "mapping")}>Mapping</button
          >
        </div>
      </div>
    </div>
    <div class="mt-1 border rounded-lg">
      {#if workbook.selectedSheet}
        <Sheet sheet={workbook.selectedSheet} {view} />
      {/if}
    </div>
  </div>
{/if}
