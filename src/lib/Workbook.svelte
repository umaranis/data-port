<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";

  type Props = {
    filePath: string;
    sheets: string[];
    onselect: (sheet: string) => void;
    selectedSheet?: string | null;
  };

  let { filePath, sheets, onselect, selectedSheet = null }: Props = $props();
</script>

<div class="mt-4 w-full max-w-3xl">
  <Tabs.Root value={selectedSheet ?? undefined} onValueChange={onselect}>
    <Tabs.List>
      {#each sheets as sheet}
        <Tabs.Trigger value={sheet}>{sheet}</Tabs.Trigger>
      {/each}
    </Tabs.List>
  </Tabs.Root>
</div>
