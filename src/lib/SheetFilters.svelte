<script lang="ts">
  type Props = {
    headerRowInput: number;
    skipRowsInput: string;
    appliedHeaderRow: number;       // 0-indexed — used to detect changes
    appliedSkipRowsInput: string;   // raw string last applied
    hiddenRowCount: number;
    onapply: () => void;
  };

  let {
    headerRowInput = $bindable(),
    skipRowsInput = $bindable(),
    appliedHeaderRow,
    appliedSkipRowsInput,
    hiddenRowCount,
    onapply,
  }: Props = $props();

  let hasChanges = $derived(
    headerRowInput !== appliedHeaderRow + 1 ||
    skipRowsInput !== appliedSkipRowsInput
  );
</script>

<div class="mt-4 flex items-center gap-2 flex-wrap">
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
  <label for="skip-rows" class="text-sm whitespace-nowrap ml-2">Skip rows:</label>
  <input
    id="skip-rows"
    type="text"
    bind:value={skipRowsInput}
    onkeydown={(e) => e.key === "Enter" && hasChanges && onapply()}
    placeholder="e.g. 1,3,5-10"
    class="border rounded px-2 py-1 text-sm w-48"
  />
  <button
    onclick={onapply}
    disabled={!hasChanges}
    class="border rounded px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    Apply
  </button>
  {#if hiddenRowCount > 0}
    <span class="text-sm text-gray-500">
      {hiddenRowCount} row{hiddenRowCount !== 1 ? "s" : ""} hidden
    </span>
  {/if}
</div>
