import { expect, test } from "vitest";
import { blockquote, unquote } from "./markdown.js";

test("blockquote()", () => {
  expect(blockquote("foo")).toBe("> foo");
  expect(blockquote("foo \n bar")).toBe("> foo \n>  bar");
  expect(blockquote("foo\n")).toBe("> foo\n");
  expect(blockquote("foo\u2028bar")).toBe("> foo\u2028> bar");
});

test("unquote()", () => {
  expect(unquote("> foo")).toBe("foo");
  expect(unquote(">foo")).toBe("foo");
  expect(unquote(">  foo")).toBe(" foo");
  expect(unquote("> foo\n> bar")).toBe("foo\nbar");
  expect(() => unquote("> foo\u2028bar")).toThrow(/invalid blockquote/);
  expect(unquote("> foo\u2028> bar")).toBe("foo\u2028bar");
});
