<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { Button } from "$lib/components/ui/button";

  let cleared = $state(false);

  async function clearCache() {
    await invoke("clear_cache");
    cleared = true;
    setTimeout(() => (cleared = false), 2000);
  }
</script>

<Button variant="outline" onclick={clearCache}>
  {cleared ? "Cache cleared" : "Clear cache"}
</Button>
