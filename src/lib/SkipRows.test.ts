import { describe, it, expect } from "vitest";
import { parseSkipInput, serializeSkipInput } from "./SkipRows";

// ─── parseSkipInput ───────────────────────────────────────────────────────────

describe("parseSkipInput", () => {
  it("returns empty array for empty string", () => {
    expect(parseSkipInput("")).toEqual([]);
  });

  it("parses a single number", () => {
    expect(parseSkipInput("3")).toEqual([3]);
  });

  it("parses comma-separated numbers", () => {
    expect(parseSkipInput("1,3,5")).toEqual([1, 3, 5]);
  });

  it("parses a range", () => {
    expect(parseSkipInput("2-4")).toEqual([2, 3, 4]);
  });

  it("parses a single-element range (start === end)", () => {
    expect(parseSkipInput("5-5")).toEqual([5]);
  });

  it("parses mixed numbers and ranges", () => {
    expect(parseSkipInput("1,3-5,8")).toEqual([1, 3, 4, 5, 8]);
  });

  it("deduplicates overlapping ranges and numbers", () => {
    expect(parseSkipInput("1-3,2-4")).toEqual([1, 2, 3, 4]);
  });

  it("deduplicates repeated numbers", () => {
    expect(parseSkipInput("2,2,2")).toEqual([2]);
  });

  it("trims whitespace around entries", () => {
    expect(parseSkipInput(" 1 , 3 - 5 ")).toEqual([1, 3, 4, 5]);
  });

  it("ignores invalid tokens", () => {
    expect(parseSkipInput("1,abc,3")).toEqual([1, 3]);
  });

  it("ignores empty tokens from trailing comma", () => {
    expect(parseSkipInput("1,2,")).toEqual([1, 2]);
  });
});

// ─── serializeSkipInput ───────────────────────────────────────────────────────

describe("serializeSkipInput", () => {
  it("returns empty string for empty set", () => {
    expect(serializeSkipInput([])).toBe("");
  });

  it("serializes a single number", () => {
    expect(serializeSkipInput([5])).toBe("5");
  });

  it("serializes non-consecutive numbers as comma list", () => {
    expect(serializeSkipInput([1, 3, 5])).toBe("1,3,5");
  });

  it("collapses consecutive numbers into a range", () => {
    expect(serializeSkipInput([2, 3, 4])).toBe("2-4");
  });

  it("collapses only the consecutive part, leaving singles separate", () => {
    expect(serializeSkipInput([1, 3, 4, 5, 8])).toBe("1,3-5,8");
  });

  it("two consecutive numbers become a range", () => {
    expect(serializeSkipInput([6, 7])).toBe("6-7");
  });

  it("sorts numbers before serializing", () => {
    expect(serializeSkipInput([5, 1, 3])).toBe("1,3,5");
  });
});

// ─── round-trip ───────────────────────────────────────────────────────────────

describe("round-trip", () => {
  it("parse → serialize → parse yields same numbers", () => {
    const input = "1,3-5,8,10-12";
    const parsed = parseSkipInput(input);
    const serialized = serializeSkipInput(parsed);
    expect(parseSkipInput(serialized)).toEqual(parsed);
  });
});
