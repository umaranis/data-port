<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { Button } from "$lib/components/ui/button";

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
  <Button onclick={selectFile}>Select Excel File</Button>

  {#if filePath}
    <p class="text-sm text-gray-500 dark:text-gray-400 break-all max-w-lg">
      {filePath}
    </p>
  {/if}
</div>
