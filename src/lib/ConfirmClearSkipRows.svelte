<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog";

  type Props = {
    open: boolean;
    onconfirm: () => void;
    oncancel: () => void;
  };

  let { open = $bindable(), onconfirm, oncancel }: Props = $props();
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Clear skipped rows?</AlertDialog.Title>
      <AlertDialog.Description>
        Changing the header row resets row numbering. Currently skipped row(s)
        will be cleared.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={oncancel}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={onconfirm}>Continue</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
