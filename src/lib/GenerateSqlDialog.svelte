<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { Button } from "$lib/components/ui/button";
  import { type ColumnMeta } from "$lib/pgTypes";

  type Props = {
    tableName: string;
    columnHeaders: string[];
    columnMeta: ColumnMeta[];
    savedConnString?: string | null;
    dropTable?: boolean;
  };

  let { tableName, columnHeaders, columnMeta, savedConnString, dropTable = false }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let connString = $state("");
  let status = $state<{ ok: true } | { ok: false; error: string } | null>(null);
  let executing = $state(false);

  function pgTypeStr(meta: ColumnMeta): string {
    switch (meta.type) {
      case "varchar":
        return meta.length ? `VARCHAR(${meta.length})` : "VARCHAR";
      case "numeric":
        if (meta.precision != null && meta.scale != null)
          return `NUMERIC(${meta.precision}, ${meta.scale})`;
        if (meta.precision != null) return `NUMERIC(${meta.precision})`;
        return "NUMERIC";
      case "timestamp":
        return meta.precision != null
          ? `TIMESTAMP(${meta.precision})`
          : "TIMESTAMP";
      case "timestamptz":
        return meta.precision != null
          ? `TIMESTAMPTZ(${meta.precision})`
          : "TIMESTAMPTZ";
      case "double precision":
        return "DOUBLE PRECISION";
      default:
        return meta.type.toUpperCase();
    }
  }

  let sql = $derived.by(() => {
    if (!tableName || columnHeaders.length === 0) return "";
    const cols = columnHeaders.map((h, i) => {
      const name = columnMeta[i]?.name || h.replaceAll(" ", "_") || `col_${i + 1}`;
      const type = pgTypeStr(columnMeta[i] ?? { type: "text" });
      return `  "${name}" ${type}`;
    });
    const create = `CREATE TABLE "${tableName}" (\n${cols.join(",\n")}\n);`;
    return dropTable
      ? `DROP TABLE IF EXISTS "${tableName}";\n${create}`
      : create;
  });

  export function open() {
    connString = savedConnString ?? "";
    status = null;
    dialog?.showModal();
  }

  function close() {
    dialog?.close();
  }

  async function execute() {
    executing = true;
    status = null;
    try {
      await invoke("pg_execute", { connString, sql });
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

<dialog
  bind:this={dialog}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
  class="rounded-xl shadow-2xl p-0 backdrop:bg-black/40 w-full max-w-2xl m-auto bg-white dark:bg-gray-900 dark:text-gray-100"
>
  <div class="flex flex-col gap-4 p-6">
    <h2 class="text-lg font-semibold">Create Table SQL</h2>

    <textarea
      readonly
      value={sql}
      rows={Math.min(20, sql.split("\n").length + 1)}
      class="font-mono text-sm border rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-900 dark:border-gray-600 resize-y w-full"
    ></textarea>

    <div class="flex flex-col gap-1">
      <label
        for="exec-conn-string"
        class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >Connection string</label
      >
      <input
        id="exec-conn-string"
        type="text"
        bind:value={connString}
        placeholder="postgresql://user:password@localhost:5432/dbname"
        class="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
      />
    </div>

    {#if status}
      <p
        class="text-sm rounded-lg px-3 py-2 {status.ok
          ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}"
      >
        {status.ok ? "Table created successfully." : status.error}
      </p>
    {/if}

    <div class="flex justify-between gap-2 mt-2">
      <Button variant="outline" onclick={copy}>Copy</Button>
      <div class="flex gap-2">
        <Button variant="outline" onclick={close}>Close</Button>
        <Button disabled={!connString || executing} onclick={execute}>
          {executing ? "Executing…" : "Execute"}
        </Button>
      </div>
    </div>
  </div>
</dialog>
