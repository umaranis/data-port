<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";

  type Props = {
    onload: (filePath: string) => void;
  };

  let { onload }: Props = $props();

  let filePath = $state<string | null>(null);

  async function selectFile() {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Excel Files", extensions: ["xlsx", "xls", "xlsm", "ods"] },
      ],
    });

    if (!selected) return;

    filePath = selected as string;
    onload(filePath);
  }
</script>

<div class="flex flex-row items-center gap-3">
  <button
    onclick={selectFile}
    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors cursor-pointer"
  >
    Select Excel File
  </button>

  {#if filePath}
    <p class="text-sm text-gray-500 dark:text-gray-400 break-all max-w-lg">
      {filePath}
    </p>
  {/if}
</div>
