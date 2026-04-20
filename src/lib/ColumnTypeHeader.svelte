<script lang="ts">
  import { PG_TYPES, TYPE_MODIFIERS, type ColumnMeta } from "$lib/pgTypes";

  type Props = { meta: ColumnMeta };
  let { meta }: Props = $props();

  let modifiers = $derived(TYPE_MODIFIERS[meta.type]);
</script>

<div class="flex flex-col gap-1 py-1 min-w-27.5">
  <select
    bind:value={meta.type}
    class="text-xs font-normal border rounded px-1 py-0.5 bg-white dark:bg-gray-800 dark:border-gray-600 cursor-pointer"
  >
    {#each PG_TYPES as type}
      <option value={type}>{type}</option>
    {/each}
  </select>
  {#if modifiers.length}
    <input
      type="number"
      min="1"
      bind:value={meta.length}
      placeholder="length"
      class="text-xs font-normal border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
    />
  {/if}
  {#if modifiers.precision}
    <input
      type="number"
      min="1"
      bind:value={meta.precision}
      placeholder="precision"
      class="text-xs font-normal border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
    />
  {/if}
  {#if modifiers.scale}
    <input
      type="number"
      min="0"
      bind:value={meta.scale}
      placeholder="scale"
      class="text-xs font-normal border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
    />
  {/if}
</div>
