<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";

  let cleared = $state(false);

  async function clearCache() {
    await invoke("clear_cache");
    cleared = true;
    setTimeout(() => (cleared = false), 2000);
  }
</script>

<button
  onclick={clearCache}
  class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
>
  {cleared ? "Cache cleared" : "Clear cache"}
</button>
