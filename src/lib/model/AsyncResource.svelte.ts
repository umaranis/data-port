export class AsyncResource {
  public error = $state<string | null>(null);
  public loading = $state(false);

  protected load(loader: () => Promise<void>) {
    this.error = null;
    this.loading = true;

    loader()
      .catch((e) => {
        this.error = String(e);
        console.error("Error loading data:", e); //TODO: add tauri logging
      })
      .finally(() => (this.loading = false));

    return;
  }
}
