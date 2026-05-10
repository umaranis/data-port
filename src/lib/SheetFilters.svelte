<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { parseSkipInput, serializeSkipInput } from "$lib/SkipRows";
  import { SheetClass } from "$lib/WorkbookClass.svelte.js";
  import ConfirmClearSkipRows from "$lib/ConfirmClearSkipRows.svelte";
  import { Button } from "$lib/components/ui/button";

  type Props = {
    filePath: string | null;
    sheet: SheetClass;
    oncommit: () => void;
  };

  let { filePath, sheet, oncommit }: Props = $props();

  let headerRowInput = $state(1);
  let confirmDialogOpen = $state(false);
  let pendingHeaderRow = $state(0);

  let input = $state("");
  let appliedInput = $state("");

  let hasChanges = $derived(
    headerRowInput !== sheet.headerRow + 1 || input !== appliedInput,
  );

  $effect(() => {
    sheet;
    headerRowInput = 1;
    input = "";
    appliedInput = "";
  });

  $effect(() => {
    if (sheet.skipRows.length === 0 && appliedInput !== "") {
      input = "";
      appliedInput = "";
    }
  });

  function applyFilters() {
    const newHeaderRow = Math.max(0, headerRowInput - 1);
    const parsedSkipRows = parseSkipInput(input);

    if (newHeaderRow !== sheet.headerRow && parsedSkipRows.length > 0) {
      pendingHeaderRow = newHeaderRow;
      confirmDialogOpen = true;
      return;
    }

    sheet.skipRows = parsedSkipRows;
    appliedInput = input;
    commitFilters(newHeaderRow);
  }

  function commitFilters(newHeaderRow: number) {
    if (newHeaderRow !== sheet.headerRow) {
      sheet.skipRows = [];
    }
    sheet.headerRow = newHeaderRow;
    oncommit();
    confirmDialogOpen = false;
  }

  async function findBlankRows() {
    if (!filePath) return;
    const blank = await invoke<number[]>("get_blank_rows", {
      path: filePath,
      sheet: sheet.name,
      headerRow: sheet.headerRow,
    });
    if (blank.length === 0) return;
    const merged = new Set([...parseSkipInput(input), ...blank]);
    input = serializeSkipInput(merged);
  }
</script>

<div class="flex items-center gap-2 flex-wrap">
  <label for="header-row" class="text-sm whitespace-nowrap">
    Header row:
    <span
      title="Rows before the header row are skipped"
      class="cursor-help text-gray-400 hover:text-gray-600">ⓘ</span
    >
  </label>
  <input
    id="header-row"
    type="number"
    min="1"
    bind:value={headerRowInput}
    onkeydown={(e) => e.key === "Enter" && hasChanges && applyFilters()}
    onchange={() => hasChanges && applyFilters()}
    class="border rounded px-2 py-1 text-sm w-16"
  />
  <label for="skip-rows" class="text-sm whitespace-nowrap ml-2"
    >Skip rows:</label
  >
  <input
    id="skip-rows"
    type="text"
    bind:value={input}
    onkeydown={(e) => e.key === "Enter" && hasChanges && applyFilters()}
    placeholder="e.g. 1,3,5-10"
    class="border rounded px-2 py-1 text-sm w-48"
  />
  <Button variant="outline" size="sm" onclick={findBlankRows}>
    Find blank rows
  </Button>
  <Button
    variant="outline"
    size="sm"
    onclick={applyFilters}
    disabled={!hasChanges}
  >
    Apply
  </Button>
  {#if sheet.skipRows.length > 0}
    <span class="text-sm text-gray-500">
      {sheet.skipRows.length} row{sheet.skipRows.length !== 1 ? "s" : ""} hidden
    </span>
  {/if}
</div>

<ConfirmClearSkipRows
  bind:open={confirmDialogOpen}
  onconfirm={() => commitFilters(pendingHeaderRow)}
/>
