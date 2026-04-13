<script lang="ts">
  type Props = {
    filePath: string;
    sheets: string[];
    onselect: (sheet: string) => void;
    selectedSheet?: string | null;
  };

  let { filePath, sheets, onselect, selectedSheet = null }: Props = $props();
</script>

<div class="text-left mt-4">
  <h3 class="font-semibold mb-1">Sheets</h3>
  <ul class="list-none pl-0 space-y-1">
    {#each sheets as sheet}
      <li>
        <button
          onclick={() => onselect(sheet)}
          class="px-3 py-1 rounded text-sm w-full text-left transition-colors
            {sheet === selectedSheet
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'}"
        >
          {sheet}
        </button>
      </li>
    {/each}
  </ul>
</div>
