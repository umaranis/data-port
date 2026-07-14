<script lang="ts">
  import type { SheetClass } from "./model/SheetClass.svelte";

  type Props = { sheet: SheetClass };
  let { sheet }: Props = $props();

  function label(tableName: string | null, i: number): string {
    return tableName && tableName.length > 0 ? tableName : `Table ${i + 1}`;
  }
</script>

<div class="m-2 flex items-center gap-2">
  <span class="text-xs text-muted-foreground">Target table:</span>
  <div class="flex flex-wrap items-center gap-1">
    {#each sheet.mappings as mapping, i (i)}
      {@const selected = i === sheet.selectedMappingIndex}
      <div
        class="inline-flex items-center rounded-md border overflow-hidden text-xs {selected
          ? 'border-primary'
          : 'border-border'}"
      >
        <button
          type="button"
          aria-pressed={selected}
          class="px-2 py-1 {selected
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted'}"
          onclick={() => (sheet.selectedMappingIndex = i)}
        >
          {label(mapping.tableName, i)}
        </button>
        {#if sheet.mappings.length > 1}
          <button
            type="button"
            aria-label="Remove table {label(mapping.tableName, i)}"
            title="Remove this mapping"
            class="px-1.5 py-1 text-muted-foreground hover:text-red-600 border-l"
            onclick={() => sheet.removeMapping(i)}
          >
            ✕
          </button>
        {/if}
      </div>
    {/each}
    <button
      type="button"
      aria-label="Add table"
      title="Add a mapping"
      class="rounded-md border border-dashed px-2 py-1 text-xs hover:bg-muted"
      onclick={() => sheet.addMapping()}
    >
      + Add table
    </button>
  </div>
</div>
