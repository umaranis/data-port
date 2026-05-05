<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { parseSkipInput, serializeSkipInput } from "$lib/SkipRows";
  import { Button } from "$lib/components/ui/button";

  type Props = {
    filePath: string | null;
    sheet: string | null;
    headerRowInput: number;
    appliedHeaderRow: number;
    skipRows: number[];
    onapply: () => void;
  };

  let {
    filePath,
    sheet,
    headerRowInput = $bindable(),
    appliedHeaderRow,
    skipRows = $bindable(),
    onapply,
  }: Props = $props();

  let input = $state("");
  let appliedInput = $state("");

  let hasChanges = $derived(
    headerRowInput !== appliedHeaderRow + 1 || input !== appliedInput,
  );

  $effect(() => {
    sheet;
    input = "";
    appliedInput = "";
  });

  $effect(() => {
    if (skipRows.length === 0 && appliedInput !== "") {
      input = "";
      appliedInput = "";
    }
  });

  function handleApply() {
    skipRows = parseSkipInput(input);
    appliedInput = input;
    onapply();
  }

  async function findBlankRows() {
    if (!filePath || !sheet) return;
    const blank = await invoke<number[]>("get_blank_rows", {
      path: filePath,
      sheet,
      headerRow: appliedHeaderRow,
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
    onkeydown={(e) => e.key === "Enter" && hasChanges && handleApply()}
    class="border rounded px-2 py-1 text-sm w-16"
  />
  <label for="skip-rows" class="text-sm whitespace-nowrap ml-2"
    >Skip rows:</label
  >
  <input
    id="skip-rows"
    type="text"
    bind:value={input}
    onkeydown={(e) => e.key === "Enter" && hasChanges && handleApply()}
    placeholder="e.g. 1,3,5-10"
    class="border rounded px-2 py-1 text-sm w-48"
  />
  <Button variant="outline" size="sm" onclick={findBlankRows}>
    Find blank rows
  </Button>
  <Button
    variant="outline"
    size="sm"
    onclick={handleApply}
    disabled={!hasChanges}
  >
    Apply
  </Button>
  {#if skipRows.length > 0}
    <span class="text-sm text-gray-500">
      {skipRows.length} row{skipRows.length !== 1 ? "s" : ""} hidden
    </span>
  {/if}
</div>
