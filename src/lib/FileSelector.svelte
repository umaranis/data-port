<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { invoke } from "@tauri-apps/api/core";

  let filePath = $state<string | null>(null);
  let sheets = $state<string[]>([]);
  let error = $state<string | null>(null);

  async function selectFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Excel Files", extensions: ["xlsx", "xls", "xlsm", "ods"] }],
    });

    if (!selected) return;

    filePath = selected as string;
    sheets = [];
    error = null;

    try {
      sheets = await invoke<string[]>("get_sheets", { path: filePath });
    } catch (e) {
      error = String(e);
    }
  }
</script>

<div class="flex flex-col items-center gap-3">
  <button
    onclick={selectFile}
    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors cursor-pointer"
  >
    Select Excel File
  </button>

  {#if filePath}
    <p class="text-sm text-gray-500 dark:text-gray-400 break-all max-w-lg">{filePath}</p>
  {/if}

  {#if error}
    <p class="text-red-600 dark:text-red-400">{error}</p>
  {/if}

  {#if sheets.length > 0}
    <div class="text-left">
      <h3 class="font-semibold mb-1">Sheets</h3>
      <ul class="list-disc pl-6">
        {#each sheets as sheet}
          <li>{sheet}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
