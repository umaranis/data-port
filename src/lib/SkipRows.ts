export function parseSkipInput(input: string): number[] {
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

export function serializeSkipInput(nums: Set<number>): string {
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

