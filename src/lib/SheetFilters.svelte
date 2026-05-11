<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { parseSkipInput, serializeSkipInput } from "$lib/SkipRows";
  import ConfirmClearSkipRows from "$lib/ConfirmClearSkipRows.svelte";
  import { Button } from "$lib/components/ui/button";
  import type { SheetClass } from "./model/SheetClass.svelte";
  import Inspect from "svelte-inspect-value";

  type Props = {
    sheet: SheetClass;
  };

  let { sheet }: Props = $props();

  let headerRowInput = $derived(sheet.headerRow + 1); // 1-based for user input
  let confirmDialogOpen = $state(false);

  let inputSkipRows = $state("");
  let appliedInputSkipRows = $state("");

  let hasHeaderRowChanges = $derived(headerRowInput !== sheet.headerRow + 1);

  let hasSkipRowsChanges = $derived(inputSkipRows !== appliedInputSkipRows);

  function confirmHeaderRowChange() {
    const newHeaderRow = Math.max(0, headerRowInput - 1);

    if (newHeaderRow !== sheet.headerRow && sheet.skipRows.length > 0) {
      confirmDialogOpen = true; // open dialog to confirm clearing skip rows
    } else {
      applyHeaderRow(newHeaderRow);
    }
  }

  function applyHeaderRow(newHeaderRow: number) {
    if (newHeaderRow !== sheet.headerRow) {
      if (sheet.skipRows.length > 0) {
        inputSkipRows = "";
        applySkipRows();
      }
    }
    sheet.setHeaderRow(newHeaderRow);
    confirmDialogOpen = false;
  }

  function applySkipRows() {
    appliedInputSkipRows = inputSkipRows;
    sheet.skipRows = parseSkipInput(inputSkipRows);
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
    onkeydown={(e) =>
      e.key === "Enter" && hasHeaderRowChanges && confirmHeaderRowChange()}
    onchange={() => hasHeaderRowChanges && confirmHeaderRowChange()}
    class="border rounded px-2 py-1 text-sm w-16"
  />
  <label for="skip-rows" class="text-sm whitespace-nowrap ml-2"
    >Skip rows:</label
  >
  <div class="relative">
    <input
      id="skip-rows"
      type="text"
      bind:value={inputSkipRows}
      onkeydown={(e) =>
        e.key === "Enter" && hasSkipRowsChanges && applySkipRows()}
      onchange={() => hasSkipRowsChanges && applySkipRows()}
      placeholder="e.g. 1,3,5-10"
      class="border rounded px-2 py-1 text-sm w-48 {inputSkipRows
        ? 'pr-6'
        : ''}"
    />
    {#if inputSkipRows}
      <button
        type="button"
        onclick={() => {
          inputSkipRows = "";
          applySkipRows();
        }}
        class="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 leading-none"
        aria-label="Clear">×</button
      >
    {/if}
  </div>
  <Button
    variant="outline"
    size="sm"
    onclick={async () => {
      await sheet.data.skipBlankRows();
      inputSkipRows = serializeSkipInput(sheet.skipRows);
      appliedInputSkipRows = inputSkipRows;
    }}
  >
    Skip blank rows
  </Button>
  {#if sheet.skipRows.length > 0}
    <span class="text-sm text-gray-500">
      {sheet.skipRows.length} row{sheet.skipRows.length !== 1 ? "s" : ""} hidden
    </span>
  {/if}
</div>

<ConfirmClearSkipRows
  bind:open={confirmDialogOpen}
  onconfirm={() => applyHeaderRow(headerRowInput - 1)}
  oncancel={() => {
    headerRowInput = sheet.headerRow + 1;
  }}
/>
