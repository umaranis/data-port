<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import * as Select from "$lib/components/ui/select";
  import { PG_TYPES, TYPE_MODIFIERS, type PgType } from "$lib/model/pgTypes";
  import type { ColumnMapping } from "./model/mappingTypes";
  import type { SheetClass } from "./model/SheetClass.svelte";
  import type { SheetMappingClass } from "./model/SheetMappingClass.svelte";
  import SourcePicker from "./SourcePicker.svelte";

  type Props = {
    index: number;
    cm: ColumnMapping;
    sheet: SheetClass;
    mapping: SheetMappingClass;
  };

  let { index, cm, sheet, mapping }: Props = $props();

  let readOnlyTarget = $derived(mapping.isReadOnlyTarget);
  let modifiers = $derived(TYPE_MODIFIERS[cm.target.dataType] ?? {});

  function setSheetSource(v: string) {
    const idx = v === "" ? -1 : Number(v);
    cm.source =
      idx < 0 ? { kind: "none" } : { kind: "sheet", sheetColIndex: idx };
  }

  let sheetSourceValue = $derived(
    cm.source.kind === "sheet" ? String(cm.source.sheetColIndex) : "",
  );
</script>

<Table.Row>
  <Table.Cell class="border text-center text-xs text-muted-foreground"
    >{index}</Table.Cell
  >

  <!-- DB column name -->
  <Table.Cell class="border">
    {#if readOnlyTarget}
      <span class="text-xs">{cm.target.dbColName}</span>
    {:else}
      <input
        type="text"
        bind:value={cm.target.dbColName}
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
      />
    {/if}
  </Table.Cell>

  <!-- Source -->
  <Table.Cell class="border">
    {#if readOnlyTarget}
      <select
        value={sheetSourceValue}
        onchange={(e) => setSheetSource(e.currentTarget.value)}
        class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
      >
        <option value="">— none —</option>
        {#each sheet.columns as col, i}
          <option value={String(i)}>{col.header}</option>
        {/each}
      </select>
    {:else}
      <SourcePicker {cm} {sheet} />
    {/if}
  </Table.Cell>

  <!-- DB type -->
  <Table.Cell class="border">
    {#if readOnlyTarget}
      <span class="text-xs">{cm.target.dataType}</span>
    {:else}
      <Select.Root
        type="single"
        value={cm.target.dataType}
        onValueChange={(v: string) => {
          cm.target.dataType = v as PgType;
        }}
      >
        <Select.Trigger
          size="sm"
          class="text-xs h-auto py-0.5 w-full font-normal"
        >
          {cm.target.dataType}
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
      {#if readOnlyTarget}
        <span class="text-xs">{cm.target.length}</span>
      {:else}
        <input
          type="number"
          min="1"
          bind:value={cm.target.length}
          placeholder="length"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
        />
      {/if}
    {/if}
  </Table.Cell>
  <Table.Cell class="border">
    {#if modifiers.precision}
      {#if readOnlyTarget}
        <span class="text-xs">{cm.target.precision}</span>
      {:else}
        <input
          type="number"
          min="1"
          bind:value={cm.target.precision}
          placeholder="precision"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
        />
      {/if}
    {/if}
  </Table.Cell>
  <Table.Cell class="border">
    {#if modifiers.scale}
      {#if readOnlyTarget}
        <span class="text-xs">{cm.target.scale}</span>
      {:else}
        <input
          type="number"
          min="0"
          bind:value={cm.target.scale}
          placeholder="scale"
          class="text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600"
        />
      {/if}
    {/if}
  </Table.Cell>

  {#if !readOnlyTarget}
    <Table.Cell class="border text-center">
      <button
        type="button"
        aria-label="Remove column"
        title="Remove column"
        onclick={() => mapping.removeColumn(index - 1)}
        class="text-muted-foreground hover:text-red-600 px-1"
      >
        ✕
      </button>
    </Table.Cell>
  {/if}
</Table.Row>
