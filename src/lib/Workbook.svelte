<script lang="ts">
  type Props = {
    filePath: string;
    sheets: string[];
  };

  let { filePath, sheets }: Props = $props();
</script>

<div class="text-left mt-4">
  <h3 class="font-semibold mb-1">Sheets</h3>
  <ul class="list-disc pl-6">
    {#each sheets as sheet}
      <li>{sheet}</li>
    {/each}
  </ul>
</div>
