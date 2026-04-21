<script lang="ts">
  import { type SkipRows } from "$lib/SkipRows.svelte";
  import { Button } from "$lib/components/ui/button";

  type Props = {
    filePath: string | null;
    sheet: string | null;
    headerRowInput: number;
    appliedHeaderRow: number;
    skipRows: SkipRows;
    onapply: () => void;
  };

  let {
    filePath,
    sheet,
    headerRowInput = $bindable(),
    appliedHeaderRow,
    skipRows,
    onapply,
  }: Props = $props();

  let hasChanges = $derived(
    headerRowInput !== appliedHeaderRow + 1 || skipRows.hasChanges,
  );

  async function findBlankRows() {
    if (!filePath || !sheet) return;
    await skipRows.findBlank(filePath, sheet, appliedHeaderRow);
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
    onkeydown={(e) => e.key === "Enter" && hasChanges && onapply()}
    class="border rounded px-2 py-1 text-sm w-16"
  />
  <label for="skip-rows" class="text-sm whitespace-nowrap ml-2"
    >Skip rows:</label
  >
  <input
    id="skip-rows"
    type="text"
    bind:value={skipRows.input}
    onkeydown={(e) => e.key === "Enter" && hasChanges && onapply()}
    placeholder="e.g. 1,3,5-10"
    class="border rounded px-2 py-1 text-sm w-48"
  />
  <Button variant="outline" size="sm" onclick={findBlankRows}>
    Find blank rows
  </Button>
  <Button variant="outline" size="sm" onclick={onapply} disabled={!hasChanges}>
    Apply
  </Button>
  {#if skipRows.applied.length > 0}
    <span class="text-sm text-gray-500">
      {skipRows.applied.length} row{skipRows.applied.length !== 1 ? "s" : ""} hidden
    </span>
  {/if}
</div>
