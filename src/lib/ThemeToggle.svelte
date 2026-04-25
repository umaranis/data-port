<script lang="ts">
  import { themeStore } from "$lib/theme.svelte.js";

  const options = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ] as const;
</script>

<div class="flex items-center gap-1 rounded-md border border-border bg-muted p-0.5 text-xs">
  {#each options as opt}
    <button
      class="rounded px-2 py-1 transition-colors {themeStore.current === opt.value
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => themeStore.set(opt.value)}
    >
      {opt.label}
    </button>
  {/each}
</div>
