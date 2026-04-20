<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";

  type Props = { onconnect?: (connString: string) => void };
  let { onconnect }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  let host = $state("localhost");
  let port = $state("5432");
  let database = $state("");
  let username = $state("");
  let password = $state("");

  let connString = $derived.by(() => {
    let userInfo = username
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : "";
    return `postgresql://${userInfo}${host}:${port}/${database}`;
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
      await invoke("pg_connect", { connString });
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

<button
  onclick={open}
  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors cursor-pointer"
>
  Connect to Postgres
</button>

<dialog
  bind:this={dialog}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
  class="rounded-xl shadow-2xl p-0 backdrop:bg-black/40 w-full max-w-md"
>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      connect();
    }}
    class="flex flex-col gap-4 p-6"
  >
    <h2 class="text-lg font-semibold">PostgreSQL Connection</h2>

    <div class="flex gap-3">
      <div class="flex flex-col gap-1 flex-1">
        <label
          for="pg-host"
          class="text-sm font-medium text-gray-700 dark:text-gray-300"
          >Host</label
        >
        <input
          id="pg-host"
          type="text"
          bind:value={host}
          class="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
        />
      </div>
      <div class="flex flex-col gap-1 w-24">
        <label
          for="pg-port"
          class="text-sm font-medium text-gray-700 dark:text-gray-300"
          >Port</label
        >
        <input
          id="pg-port"
          type="text"
          bind:value={port}
          class="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
        />
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <label
        for="pg-database"
        class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >Database</label
      >
      <input
        id="pg-database"
        type="text"
        bind:value={database}
        class="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
      />
    </div>

    <div class="flex flex-col gap-1">
      <label
        for="pg-username"
        class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >Username</label
      >
      <input
        id="pg-username"
        type="text"
        bind:value={username}
        class="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
      />
    </div>

    <div class="flex flex-col gap-1">
      <label
        for="pg-password"
        class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >Password</label
      >
      <input
        id="pg-password"
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
        class="text-xs bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 break-all select-all"
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
      <button
        type="button"
        onclick={close}
        class="px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={connecting}
        class="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        {connecting ? "Connecting…" : "Connect"}
      </button>
    </div>
  </form>
</dialog>
