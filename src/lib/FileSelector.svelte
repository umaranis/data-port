<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { invoke } from "@tauri-apps/api/core";

  type Props = {
    onload: (filePath: string, sheets: string[]) => void;
  };

  let { onload }: Props = $props();

  let filePath = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function selectFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Excel Files", extensions: ["xlsx", "xls", "xlsm", "ods"] }],
    });

    if (!selected) return;

    filePath = selected as string;
    error = null;

    try {
      const sheets = await invoke<string[]>("get_sheets", { path: filePath });
      onload(filePath, sheets);
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
</div>
