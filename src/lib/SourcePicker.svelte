<script lang="ts">
  import type { ColumnMapping, Source } from "./model/mappingTypes";
  import type { SheetClass } from "./model/SheetClass.svelte";

  type Props = {
    cm: ColumnMapping;
    sheet: SheetClass;
  };

  let { cm, sheet }: Props = $props();

  const KINDS: { value: Source["kind"]; label: string }[] = [
    { value: "sheet", label: "Sheet column" },
    { value: "static", label: "Static value" },
    { value: "expression", label: "Expression" },
    { value: "db-serial", label: "DB serial" },
    { value: "custom-sequence", label: "Custom sequence" },
    { value: "none", label: "— none —" },
  ];

  /** Build a fresh Source of the chosen kind with sensible defaults. */
  function defaultSource(kind: Source["kind"]): Source {
    switch (kind) {
      case "sheet":
        return { kind: "sheet", sheetColIndex: 0 };
      case "static":
        return { kind: "static", value: "" };
      case "expression":
        return { kind: "expression", expression: "" };
      case "db-serial":
        return { kind: "db-serial", dbSequenceName: "" };
      case "custom-sequence":
        return {
          kind: "custom-sequence",
          sequenceStart: 1,
          padding: null,
          prefix: "",
          postfix: "",
        };
      case "none":
        return { kind: "none" };
    }
  }

  function setKind(kind: string) {
    cm.source = defaultSource(kind as Source["kind"]);
  }

  const inputClass =
    "text-xs border rounded px-1 py-0.5 w-full dark:bg-gray-800 dark:border-gray-600";
</script>

<div class="flex flex-col gap-1">
  <select
    aria-label="Source kind"
    value={cm.source.kind}
    onchange={(e) => setKind(e.currentTarget.value)}
    class={inputClass}
  >
    {#each KINDS as k}
      <option value={k.value}>{k.label}</option>
    {/each}
  </select>

  {#if cm.source.kind === "sheet"}
    <select
      aria-label="Sheet column"
      value={String(cm.source.sheetColIndex)}
      onchange={(e) =>
        (cm.source = {
          kind: "sheet",
          sheetColIndex: Number(e.currentTarget.value),
        })}
      class={inputClass}
    >
      {#each sheet.columns as col, i}
        <option value={String(i)}>{col.header}</option>
      {/each}
    </select>
  {:else if cm.source.kind === "static"}
    <input
      type="text"
      aria-label="Static value"
      bind:value={cm.source.value}
      placeholder="value"
      class={inputClass}
    />
  {:else if cm.source.kind === "expression"}
    <input
      type="text"
      aria-label="Expression"
      bind:value={cm.source.expression}
      placeholder="expression"
      class={inputClass}
    />
  {:else if cm.source.kind === "db-serial"}
    <input
      type="text"
      aria-label="DB sequence name"
      bind:value={cm.source.dbSequenceName}
      placeholder="sequence name"
      class={inputClass}
    />
  {:else if cm.source.kind === "custom-sequence"}
    <div class="flex gap-1">
      <input
        type="number"
        aria-label="Sequence start"
        bind:value={cm.source.sequenceStart}
        placeholder="start"
        class={inputClass}
      />
      <input
        type="number"
        aria-label="Padding"
        bind:value={cm.source.padding}
        placeholder="pad"
        class={inputClass}
      />
    </div>
    <div class="flex gap-1">
      <input
        type="text"
        aria-label="Prefix"
        bind:value={cm.source.prefix}
        placeholder="prefix"
        class={inputClass}
      />
      <input
        type="text"
        aria-label="Postfix"
        bind:value={cm.source.postfix}
        placeholder="postfix"
        class={inputClass}
      />
    </div>
  {/if}
</div>
