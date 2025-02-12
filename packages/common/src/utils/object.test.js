import { describe, expect, test } from "vitest";
import { traverse } from "./object.js";

describe("traverse", () => {
  test("handles primitive values", () => {
    const mapper = (x) => x;
    expect(traverse(123, mapper)).toBe(123);
    expect(traverse("string", mapper)).toBe("string");
    expect(traverse(true, mapper)).toBe(true);
    expect(traverse(null, mapper)).toBe(null);
    expect(traverse(undefined, mapper)).toBe(undefined);
  });

  test("transforms primitive values with mapper", () => {
    const mapper = (x) => (typeof x === "number" ? x * 2 : x);
    expect(traverse(5, mapper)).toBe(10);
    expect(traverse("string", mapper)).toBe("string");
  });

  test("handles arrays", () => {
    const input = [1, 2, 3];
    const mapper = (x) => (typeof x === "number" ? x * 2 : x);
    expect(traverse(input, mapper)).toEqual([2, 4, 6]);
  });

  test("handles nested arrays", () => {
    const input = [1, [2, 3], [4, [5, 6]]];
    const mapper = (x) => (typeof x === "number" ? x * 2 : x);
    expect(traverse(input, mapper)).toEqual([2, [4, 6], [8, [10, 12]]]);
  });

  test("handles objects", () => {
    const input = { a: 1, b: 2, c: 3 };
    const mapper = (x) => (typeof x === "number" ? x * 2 : x);
    expect(traverse(input, mapper)).toEqual({ a: 2, b: 4, c: 6 });
  });

  test("handles nested objects", () => {
    const input = {
      a: 1,
      b: { c: 2, d: { e: 3 } },
      f: 4,
    };
    const mapper = (x) => (typeof x === "number" ? x * 2 : x);
    expect(traverse(input, mapper)).toEqual({
      a: 2,
      b: { c: 4, d: { e: 6 } },
      f: 8,
    });
  });

  test("handles mixed nested structures", () => {
    const input = {
      a: [1, 2],
      b: { c: [3, { d: 4 }] },
      e: 5,
    };
    const mapper = (x) => (typeof x === "number" ? x * 2 : x);
    expect(traverse(input, mapper)).toEqual({
      a: [2, 4],
      b: { c: [6, { d: 8 }] },
      e: 10,
    });
  });

  test("handles complex mapper functions", () => {
    const input = {
      numbers: [1, 2, 3],
      strings: ["a", "b"],
      nested: { value: 4 },
    };
    const mapper = (value) => {
      if (typeof value === "number") return value * 2;
      if (typeof value === "string") return value.toUpperCase();
      return value;
    };
    expect(traverse(input, mapper)).toEqual({
      numbers: [2, 4, 6],
      strings: ["A", "B"],
      nested: { value: 8 },
    });
  });
});
