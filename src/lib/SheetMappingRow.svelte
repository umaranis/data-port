<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import * as Select from "$lib/components/ui/select";
  import { PG_TYPES, TYPE_MODIFIERS, type PgType, type DbColumn } from "$lib/model/pgTypes";
  import type { SheetColumn } from "$lib/model/SheetColumnClass.svelte";

  const COL_TYPE_LABELS: Record<string, string> = {
    sheet: "Sheet",
    duplicate: "Duplicate",
    static: "Static",
    formula: "Formula",
    "db-serial": "DB Serial",
    "custom-sequence": "Custom Seq",
  };

  type Props = {
    index: number;
    column: SheetColumn;
    dbColumns: ReadonlyArray<Readonly<DbColumn>> | null;
  };

  let { index, column, dbColumns }: Props = $props();

  let modifiers = $derived(TYPE_MODIFIERS[column.dataType] ?? {});
</script>

<Table.Row>
  <Table.Cell class="border text-center text-xs text-muted-foreground">{index}</Table.Cell>

  <Table.Cell class="border text-xs whitespace-nowrap">
    {COL_TYPE_LABELS[column.type] ?? column.type}
  </Table.Cell>

  <!-- type-specific config -->
  <Table.Cell class="border">
    {#if column.type === "sheet"}
      <span class="text-xs font-medium">{column.header}</span>
    {:else if column.type === "duplicate"}
      <input type="number" min="0" bind:value={column.sourceColIndex} placeholder="source index"
        class="text-xs border rounded px-1 py-0.5 w-24 dark:bg-gray-800 dark:border-gray-600" />
    {:else if column.type === "static"}
      <input type="text" bind:value={column.text} placeholder="value"
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600" />
    {:else if column.type === "formula"}
      <input type="text" bind:value={column.formula} placeholder="formula"
        class="text-xs border rounded px-1 py-0.5 w-full font-mono dark:bg-gray-800 dark:border-gray-600" />
    {:else if column.type === "db-serial"}
      <input type="text" bind:value={column.dbSequenceName} placeholder="sequence name"
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600" />
    {:else if column.type === "custom-sequence"}
      <div class="flex flex-col gap-0.5">
        <input type="number" bind:value={column.sequenceStart} placeholder="start"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600" />
        <input type="number" bind:value={column.padding} placeholder="padding"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600" />
        <input type="text" bind:value={column.prefix} placeholder="prefix"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600" />
        <input type="text" bind:value={column.postfix} placeholder="postfix"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600" />
      </div>
    {/if}
  </Table.Cell>

  <!-- excluded (sheet only) -->
  <Table.Cell class="border text-center">
    {#if column.type === "sheet"}
      <input type="checkbox" bind:checked={column.excluded} class="cursor-pointer" />
    {/if}
  </Table.Cell>

  <!-- DB column name -->
  <Table.Cell class="border">
    {#if dbColumns}
      <select bind:value={column.dbColName}
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600">
        <option value={undefined}>— none —</option>
        {#each dbColumns as col}
          <option value={col.dbColName}>{col.dbColName}</option>
        {/each}
      </select>
    {:else}
      <input type="text" bind:value={column.dbColName}
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600" />
    {/if}
  </Table.Cell>

  <!-- DB type -->
  <Table.Cell class="border">
    <Select.Root type="single" value={column.dataType}
      onValueChange={(v: string) => { column.dataType = v as PgType; }}>
      <Select.Trigger size="sm" class="text-xs h-auto py-0.5 w-full font-normal">
        {column.dataType}
      </Select.Trigger>
      <Select.Content>
        {#each PG_TYPES as type}
          <Select.Item value={type} class="text-xs">{type}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </Table.Cell>

  <Table.Cell class="border">
    {#if modifiers.length}
      <input type="number" min="1" bind:value={column.length} placeholder="length"
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600" />
    {/if}
  </Table.Cell>
  <Table.Cell class="border">
    {#if modifiers.precision}
      <input type="number" min="1" bind:value={column.precision} placeholder="precision"
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600" />
    {/if}
  </Table.Cell>
  <Table.Cell class="border">
    {#if modifiers.scale}
      <input type="number" min="0" bind:value={column.scale} placeholder="scale"
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600" />
    {/if}
  </Table.Cell>
</Table.Row>
