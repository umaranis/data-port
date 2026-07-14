<script lang="ts">
  import SheetFilters from "$lib/SheetFilters.svelte";
  import { SheetClass } from "$lib/model/SheetClass.svelte.js";
  import SheetActionOptions from "$lib/SheetActionOptions.svelte";
  import SheetTableMapping from "$lib/SheetTableMapping.svelte";
  import SheetPreview from "$lib/SheetPreview.svelte";
  import MappingPreview from "$lib/MappingPreview.svelte";
  import MappingSelector from "$lib/MappingSelector.svelte";

  type Props = {
    sheet: SheetClass;
    view: "data" | "mapping" | "preview";
  };

  let { sheet, view = "data" }: Props = $props();

  let mapping = $derived(sheet.selectedMapping);
</script>

{#if sheet.columns.length > 0}
  <div class="m-2 flex items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <label class="flex items-center gap-1.5 text-sm whitespace-nowrap">
        <input
          type="checkbox"
          aria-label="Skipped"
          checked={sheet.skipped}
          onchange={(e) => (sheet.skipped = e.currentTarget.checked)}
        />
        Skipped
      </label>
      <SheetActionOptions {sheet} {mapping} />
    </div>
    <SheetFilters {sheet} />
  </div>

  {#if view === "mapping"}
    <MappingSelector {sheet} />
    <SheetTableMapping {sheet} {mapping} />
  {:else if view === "preview"}
    <MappingSelector {sheet} />
    <MappingPreview {sheet} {mapping} />
  {:else}
    <SheetPreview data={sheet.data} />
  {/if}
{/if}
