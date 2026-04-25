<script>
  import "../app.css";
  import { themeStore } from "$lib/theme.svelte.js";

  // Reference themeStore to ensure it initializes on load
  themeStore.current;
</script>

<slot />
