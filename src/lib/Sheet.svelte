<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import SheetFilters from "$lib/SheetFilters.svelte";
  import { untrack } from "svelte";
  import { SheetClass } from "$lib/model/SheetClass.svelte.js";
  import SheetActionOptions from "$lib/SheetActionOptions.svelte";
  import SheetTableMapping from "$lib/SheetTableMapping.svelte";
  import SheetPreview from "$lib/SheetPreview.svelte";

  type Props = {
    sheet: SheetClass;
    view: "data" | "mapping";
  };

  let { sheet, view = "data" }: Props = $props();
</script>

{#if sheet.columns.length > 0}
  <div class="m-2 flex items-center justify-between gap-4">
    <SheetActionOptions {sheet} />
    <SheetFilters {sheet} />
  </div>

  {#if view === "mapping"}
    <SheetTableMapping {sheet} />
  {:else}
    <SheetPreview data={sheet.data} />
  {/if}
{/if}
