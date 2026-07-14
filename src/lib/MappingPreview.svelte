<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import { Button } from "$lib/components/ui/button";
  import Paging from "$lib/Paging.svelte";
  import { resolvePreviewCell } from "$lib/model/mappingTypes";
  import type { SheetClass } from "./model/SheetClass.svelte";
  import type { SheetMappingClass } from "./model/SheetMappingClass.svelte";
  import { getDatabaseContext } from "./model/databaseContext";

  type Props = {
    sheet: SheetClass;
    mapping: SheetMappingClass;
  };

  let { sheet, mapping }: Props = $props();

  let database = getDatabaseContext();

  /** Mapped Target Columns in order; unmapped (Source "none") are omitted. */
  let shownColumns = $derived(
    mapping.columns.filter((cm) => cm.source.kind !== "none"),
  );

  let dropTable = $derived(mapping.action === "recreate");

  /** Generated DDL. Append has no DDL; create/recreate render CREATE (+ DROP). */
  let sql = $derived.by(() => {
    if (mapping.action === "append") return "";
    if (!mapping.tableName || shownColumns.length === 0) return "";
    const cols = shownColumns
      .filter((cm) => cm.target.dbColName)
      .map((cm) => `  "${cm.target.dbColName}" ${database.typeStr(cm.target)}`);
    const create = `CREATE TABLE "${mapping.tableName}" (\n${cols.join(",\n")}\n);`;
    return dropTable
      ? `DROP TABLE IF EXISTS "${mapping.tableName}";\n${create}`
      : create;
  });

  let connString = $state("");
  $effect(() => {
    connString = database.connectionString ?? "";
  });

  let status = $state<{ ok: true } | { ok: false; error: string } | null>(null);
  let executing = $state(false);

  async function execute() {
    executing = true;
    status = null;
    try {
      await database.execute(sql);
      status = { ok: true };
    } catch (e) {
      status = { ok: false, error: String(e) };
    } finally {
      executing = false;
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(sql);
  }
</script>

{#if shownColumns.length > 0}
  <div class="mt-2 overflow-x-auto">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          {#each shownColumns as cm}
            <Table.Head
              class="border whitespace-nowrap bg-gray-50 dark:bg-gray-950 font-semibold"
              >{cm.target.dbColName || "—"}</Table.Head
            >
          {/each}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each sheet.data.rows as row}
          <Table.Row>
            {#each shownColumns as cm}
              <Table.Cell class="whitespace-nowrap border"
                >{resolvePreviewCell(cm.source, row)}</Table.Cell
              >
            {/each}
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
  <div class="pr-2 float-right">
    <Paging data={sheet.data} />
  </div>
  <div class="clear-both"></div>
{:else}
  <p class="mt-2 text-sm text-muted-foreground">
    No mapped columns to preview.
  </p>
{/if}

{#if sql}
  <div class="mt-4 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold">Generated SQL</h3>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={copy}>Copy</Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!connString || executing}
          onclick={execute}
        >
          {executing ? "Executing…" : "Execute"}
        </Button>
      </div>
    </div>
    <textarea
      readonly
      aria-label="Generated SQL"
      value={sql}
      rows={Math.min(20, sql.split("\n").length + 1)}
      class="font-mono text-sm border rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-900 dark:border-gray-600 resize-y w-full"
    ></textarea>
    <input
      type="text"
      aria-label="Connection string"
      bind:value={connString}
      placeholder="Connection string"
      class="border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
    />
    {#if status}
      <p
        class="text-sm rounded-lg px-3 py-2 {status.ok
          ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}"
      >
        {status.ok ? "Executed successfully." : status.error}
      </p>
    {/if}
  </div>
{/if}
