import { invoke } from "@tauri-apps/api/core";

export class SkipRows {
  input = $state("");
  appliedInput = $state("");
  applied = $state<number[]>([]);
  hasChanges = $derived(this.input !== this.appliedInput);

  apply() {
    this.appliedInput = this.input;
    this.applied = this.#parse(this.input);
  }

  reset() {
    this.input = "";
    this.appliedInput = "";
    this.applied = [];
  }

  async findBlank(path: string, sheet: string, headerRow: number) {
    const blank = await invoke<number[]>("get_blank_rows", { path, sheet, headerRow });
    if (blank.length === 0) return;
    const merged = new Set([...this.#parse(this.input), ...blank]);
    this.input = this.#serialize(merged);
  }

  #serialize(nums: Set<number>): string {
    const sorted = [...nums].sort((a, b) => a - b);
    const parts: string[] = [];
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
      parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : `${sorted[i]}`);
      i = j + 1;
    }
    return parts.join(",");
  }

  #parse(input: string): number[] {
    const result = new Set<number>();
    for (const part of input.split(",")) {
      const trimmed = part.trim();
      const range = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) {
        const start = parseInt(range[1]);
        const end = parseInt(range[2]);
        for (let i = start; i <= end; i++) result.add(i);
      } else if (/^\d+$/.test(trimmed)) {
        result.add(parseInt(trimmed));
      }
    }
    return Array.from(result);
  }
}
