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

<div class="file-selector">
  <button onclick={selectFile}>Select Excel File</button>

  {#if filePath}
    <p class="file-path">{filePath}</p>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if sheets.length > 0}
    <div class="sheets">
      <h3>Sheets</h3>
      <ul>
        {#each sheets as sheet}
          <li>{sheet}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .file-selector {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .file-path {
    font-size: 0.85em;
    color: #666;
    word-break: break-all;
    max-width: 500px;
  }

  .error {
    color: #c0392b;
  }

  .sheets {
    text-align: left;
  }

  .sheets h3 {
    margin-bottom: 0.25rem;
  }

  .sheets ul {
    list-style: disc;
    padding-left: 1.5rem;
  }
</style>
