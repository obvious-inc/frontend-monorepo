import { describe, expect, test } from "vitest";
import { generateDummyId } from "./misc.js";

describe("generateDummyId", () => {
  test("increments the returned id each call", () => {
    const first = generateDummyId();
    const second = generateDummyId();
    const third = generateDummyId();
    expect([first, second, third]).toEqual([0, 1, 2]);
  });
});
