<script lang="ts">
  import * as Select from "$lib/components/ui/select";
  import {
    PG_TYPES,
    TYPE_MODIFIERS,
    type PgType,
    type DbColumn,
  } from "$lib/model/pgTypes";

  type Props = { meta: DbColumn };
  let { meta }: Props = $props();

  let modifiers = $derived(TYPE_MODIFIERS[meta.dataType] ?? {});
</script>

<div class="flex flex-col gap-1 py-1 min-w-27.5">
  <input
    type="text"
    bind:value={meta.dbColName}
    class="text-xs font-normal border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
  />
  <Select.Root
    type="single"
    value={meta.dataType}
    onValueChange={(v: string) => {
      meta.dataType = v as PgType;
    }}
  >
    <Select.Trigger size="sm" class="text-xs h-auto py-0.5 w-full font-normal">
      {meta.dataType}
    </Select.Trigger>
    <Select.Content>
      {#each PG_TYPES as type}
        <Select.Item value={type} class="text-xs">{type}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
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
