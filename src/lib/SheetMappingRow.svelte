<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import * as Select from "$lib/components/ui/select";
  import { PG_TYPES, TYPE_MODIFIERS, type PgType } from "$lib/model/pgTypes";
  import type { SheetColumnForMapping } from "./SheetTableMapping.svelte";
  import type { SheetClass } from "./model/SheetClass.svelte";

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
    column: SheetColumnForMapping;
    sheet: SheetClass;
  };

  let { index, column, sheet }: Props = $props();

  let modifiers = $derived(TYPE_MODIFIERS[column.dataType] ?? {});
</script>

<Table.Row>
  <Table.Cell class="border text-center text-xs text-muted-foreground"
    >{index}</Table.Cell
  >

  <!-- DB column name -->
  <Table.Cell class="border">
    {#if sheet.dbColumns}
      {column.dbColName}
    {:else}
      <input
        type="text"
        bind:value={column.dbColName}
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
      />
    {/if}
  </Table.Cell>

  <Table.Cell class="border text-xs whitespace-nowrap">
    {COL_TYPE_LABELS[column.type] ?? column.type}
  </Table.Cell>

  <!-- type-specific mapping -->
  <Table.Cell class="border">
    {#if column.type === "sheet"}
      {#if sheet.dbColumns}
        <Select.Root
          type="single"
          value={column.header}
          onValueChange={(v: string) => {
            console.log("onValueChange: ", v);
            const newCol = sheet.columns.find(
              (c) => c.type === "sheet" && c.header === v,
            );
            console.log("find newCol: ", newCol);
            if (newCol) {
              if (!newCol.dbColName) {
                console.log("newCol.dbColName: ", newCol.dbColName);
                console.log("column.dbColName: ", column.dbColName);
                newCol.dbColName = column.dbColName;
              }
            }

            if (column.type === "sheet") {
              column.dbColName = undefined;
            }
          }}
        >
          <Select.Trigger
            size="sm"
            class="text-xs h-auto py-0.5 w-full font-normal"
          >
            {column.header}
          </Select.Trigger>
          <Select.Content>
            <!-- <Select.Item value={undefined}>— none —</Select.Item> -->
            {#each sheet.columns.filter((c) => c.type === "sheet") as { header }}
              <Select.Item value={header} class="text-xs">{header}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {:else}
        <span class="text-xs font-medium">{column.header}</span>
      {/if}
    {:else if column.type === "duplicate"}
      <input
        type="number"
        min="0"
        bind:value={column.sourceColIndex}
        placeholder="source index"
        class="text-xs border rounded px-1 py-0.5 w-24 dark:bg-gray-800 dark:border-gray-600"
      />
    {:else if column.type === "static"}
      <input
        type="text"
        bind:value={column.text}
        placeholder="value"
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
      />
    {:else if column.type === "formula"}
      <input
        type="text"
        bind:value={column.formula}
        placeholder="formula"
        class="text-xs border rounded px-1 py-0.5 w-full font-mono dark:bg-gray-800 dark:border-gray-600"
      />
    {:else if column.type === "db-serial"}
      <input
        type="text"
        bind:value={column.dbSequenceName}
        placeholder="sequence name"
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
      />
    {:else if column.type === "custom-sequence"}
      <div class="flex flex-col gap-0.5">
        <input
          type="number"
          bind:value={column.sequenceStart}
          placeholder="start"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
        />
        <input
          type="number"
          bind:value={column.padding}
          placeholder="padding"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
        />
        <input
          type="text"
          bind:value={column.prefix}
          placeholder="prefix"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
        />
        <input
          type="text"
          bind:value={column.postfix}
          placeholder="postfix"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
        />
      </div>
    {/if}
  </Table.Cell>

  <!-- excluded (sheet only) -->
  <Table.Cell class="border text-center">
    {#if column.type === "sheet"}
      <input
        type="checkbox"
        bind:checked={column.excluded}
        class="cursor-pointer"
      />
    {/if}
  </Table.Cell>

  <!-- DB type -->
  <Table.Cell class="border">
    {#if sheet.dbColumns}
      {column.dataType}
    {:else}
      <Select.Root
        type="single"
        value={column.dataType}
        onValueChange={(v: string) => {
          column.dataType = v as PgType;
        }}
      >
        <Select.Trigger
          size="sm"
          class="text-xs h-auto py-0.5 w-full font-normal"
        >
          {column.dataType}
        </Select.Trigger>
        <Select.Content>
          {#each PG_TYPES as type}
            <Select.Item value={type} class="text-xs">{type}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    {/if}
  </Table.Cell>

  <Table.Cell class="border">
    {#if modifiers.length}
      {#if sheet.dbColumns}
        {column.length}
      {:else}
        <input
          type="number"
          min="1"
          bind:value={column.length}
          placeholder="length"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
        />
      {/if}
    {/if}
  </Table.Cell>
  <Table.Cell class="border">
    {#if modifiers.precision}
      {#if sheet.dbColumns}
        {column.precision}
      {:else}
        <input
          type="number"
          min="1"
          bind:value={column.precision}
          placeholder="precision"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
        />
      {/if}
    {/if}
  </Table.Cell>
  <Table.Cell class="border">
    {#if modifiers.scale}
      {#if sheet.dbColumns}
        {column.scale}
      {:else}
        <input
          type="number"
          min="0"
          bind:value={column.scale}
          placeholder="scale"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
        />
      {/if}
    {/if}
  </Table.Cell>
</Table.Row>
