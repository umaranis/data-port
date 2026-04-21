<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog";

  type Props = {
    open: boolean;
    count: number;
    onconfirm: () => void;
  };

  let { open = $bindable(), count, onconfirm }: Props = $props();
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Clear skipped rows?</AlertDialog.Title>
      <AlertDialog.Description>
        Changing the header row resets row numbering. The {count} currently skipped
        row{count !== 1 ? "s" : ""} will be cleared.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={onconfirm}>Continue</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
