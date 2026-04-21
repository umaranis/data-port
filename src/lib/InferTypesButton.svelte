<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { Button } from "$lib/components/ui/button";

  type Props = {
    filePath: string | null;
    sheet: string | null;
    headerRow: number;
    skipRows: number[];
    oninfer: (types: string[]) => void;
  };

  let { filePath, sheet, headerRow, skipRows, oninfer }: Props = $props();

  async function infer() {
    if (!filePath || !sheet) return;
    const types = await invoke<string[]>("infer_column_types", {
      path: filePath,
      sheet,
      headerRow,
      skipRows,
    });
    oninfer(types);
  }
</script>

<Button variant="outline" size="sm" onclick={infer}>Infer types</Button>
