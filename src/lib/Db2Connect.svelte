<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { Button } from "$lib/components/ui/button";

  type Props = {
    onconnect?: (connString: string) => void;
    initialConnString?: string | null;
  };
  let { onconnect, initialConnString = null }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  let driver = $state("IBM DB2 ODBC DRIVER");
  let host = $state("localhost");
  let port = $state("50000");
  let database = $state("");
  let username = $state("");
  let password = $state("");

  let connString = $derived(
    `Driver={${driver}};Database=${database};Hostname=${host};Port=${port};Protocol=TCPIP;Uid=${username};Pwd=${password};`,
  );

  $effect(() => {
    if (!initialConnString) return;
    const fields: Record<string, string> = {};
    initialConnString.split(";").forEach((token) => {
      const eq = token.indexOf("=");
      if (eq === -1) return;
      const key = token.slice(0, eq).trim().toLowerCase();
      const value = token.slice(eq + 1).trim();
      fields[key] = value;
    });
    const driverMatch = (fields["driver"] ?? "").match(/^\{(.+)\}$/);
    driver = driverMatch
      ? driverMatch[1]
      : (fields["driver"] ?? "IBM DB2 ODBC DRIVER");
    host = fields["hostname"] ?? "localhost";
    port = fields["port"] ?? "50000";
    database = fields["database"] ?? "";
    username = fields["uid"] ?? "";
    password = fields["pwd"] ?? "";
  });

  type Status = { ok: true } | { ok: false; error: string } | null;
  let status = $state<Status>(null);
  let connecting = $state(false);

  function open() {
    status = null;
    dialog?.showModal();
  }

  function close() {
    dialog?.close();
  }

  async function connect() {
    connecting = true;
    status = null;
    try {
      await invoke("db2_connect", { connString });
      status = { ok: true };
      onconnect?.(connString);
    } catch (e) {
      status = { ok: false, error: String(e) };
    } finally {
      connecting = false;
      if (status?.ok) {
        setTimeout(() => {
          close();
        }, 1000);
      }
    }
  }
</script>

<Button onclick={open}>Connect to DB2</Button>

<dialog
  bind:this={dialog}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
  class="rounded-xl shadow-2xl p-0 backdrop:bg-black/40 w-full max-w-md bg-white dark:bg-gray-900 dark:text-gray-100 m-auto"
>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      connect();
    }}
    class="flex flex-col gap-4 p-6"
  >
    <h2 class="text-lg font-semibold">DB2 Connection</h2>

    <div class="flex flex-col gap-1">
      <label
        for="db2-driver"
        class="text-sm font-medium text-gray-700 dark:text-gray-300">Driver</label
      >
      <input
        id="db2-driver"
        type="text"
        bind:value={driver}
        class="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
      />
    </div>

    <div class="flex gap-3">
      <div class="flex flex-col gap-1 flex-1">
        <label
          for="db2-host"
          class="text-sm font-medium text-gray-700 dark:text-gray-300">Host</label
        >
        <input
          id="db2-host"
          type="text"
          bind:value={host}
          class="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
        />
      </div>
      <div class="flex flex-col gap-1 w-24">
        <label
          for="db2-port"
          class="text-sm font-medium text-gray-700 dark:text-gray-300">Port</label
        >
        <input
          id="db2-port"
          type="text"
          bind:value={port}
          class="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
        />
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <label
        for="db2-database"
        class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >Database</label
      >
      <input
        id="db2-database"
        type="text"
        bind:value={database}
        class="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
      />
    </div>

    <div class="flex flex-col gap-1">
      <label
        for="db2-username"
        class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >Username</label
      >
      <input
        id="db2-username"
        type="text"
        bind:value={username}
        class="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
      />
    </div>

    <div class="flex flex-col gap-1">
      <label
        for="db2-password"
        class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >Password</label
      >
      <input
        id="db2-password"
        type="password"
        bind:value={password}
        class="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
      />
    </div>

    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-gray-500 dark:text-gray-400"
        >Connection string</span
      >
      <code
        class="text-xs bg-gray-100 dark:bg-gray-800 dark:text-gray-300 rounded-lg px-3 py-2 break-all select-all"
        >{connString}</code
      >
    </div>

    {#if status}
      <p
        class="text-sm rounded-lg px-3 py-2 {status.ok
          ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}"
      >
        {status.ok ? "Connected successfully." : status.error}
      </p>
    {/if}

    <div class="flex justify-end gap-2 mt-2">
      <Button type="button" variant="outline" onclick={close}>Cancel</Button>
      <Button type="submit" disabled={connecting}>
        {connecting ? "Connecting…" : "Connect"}
      </Button>
    </div>
  </form>
</dialog>
