import { expect, test } from "vitest";
import { blockquote, unquote, toMessageBlocks } from "./markdown.js";

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

test("toMessageBlocks - simple image", () => {
  const text = "![Alt text](https://example.com/image.jpg)";
  const blocks = toMessageBlocks(text);
  expect(blocks).toEqual([
    {
      type: "image-grid",
      children: [
        {
          type: "image",
          url: "https://example.com/image.jpg",
          alt: "Alt text",
          interactive: false,
        },
      ],
    },
  ]);
});

test("toMessageBlocks - image with caption", () => {
  const text = '![Alt text](https://example.com/image.jpg "Image caption")';
  const blocks = toMessageBlocks(text);
  expect(blocks[0].children[0]).toEqual({
    type: "image",
    url: "https://example.com/image.jpg",
    alt: "Alt text",
    caption: "Image caption",
    interactive: false,
  });
});

test("toMessageBlocks - multiple images in a row", () => {
  const text =
    "![First](https://example.com/image1.jpg) ![Second](https://example.com/image2.jpg)";
  const blocks = toMessageBlocks(text);
  expect(blocks).toEqual([
    {
      type: "image-grid",
      children: [
        {
          type: "image",
          url: "https://example.com/image1.jpg",
          alt: "First",
          interactive: false,
        },
        {
          type: "image",
          url: "https://example.com/image2.jpg",
          alt: "Second",
          interactive: false,
        },
      ],
    },
  ]);
});

test("toMessageBlocks - image mixed with text", () => {
  const text =
    "Text before ![Alt text](https://example.com/image.jpg) text after";
  const blocks = toMessageBlocks(text);

  // Should split into separate paragraph and image-grid blocks
  expect(blocks.length).toBeGreaterThan(1);

  // Check that we have the expected blocks
  const hasTextBefore = blocks.some(
    (block) =>
      block.type === "paragraph" &&
      block.children.some(
        (child) => child.text && child.text.includes("Text before"),
      ),
  );

  const hasImage = blocks.some(
    (block) =>
      block.type === "image-grid" &&
      block.children.some(
        (child) =>
          child.type === "image" &&
          child.url === "https://example.com/image.jpg",
      ),
  );

  const hasTextAfter = blocks.some(
    (block) =>
      block.type === "paragraph" &&
      block.children.some(
        (child) => child.text && child.text.includes("text after"),
      ),
  );

  expect(hasTextBefore).toBe(true);
  expect(hasImage).toBe(true);
  expect(hasTextAfter).toBe(true);
});

test("toMessageBlocks - with displayImages=false", () => {
  const text = "![Alt text](https://example.com/image.jpg)";
  const blocks = toMessageBlocks(text, { displayImages: false });

  // With displayImages=false, image markdown becomes a link
  // Since it's in a paragraph
  expect(blocks[0].type).toBe("paragraph");
  expect(blocks[0].children[0].type).toBe("link");
  expect(blocks[0].children[0].url).toBe("https://example.com/image.jpg");
});

test("toMessageBlocks - link to image file", () => {
  const text = "[Image link](https://example.com/photo.jpg)";

  // When displayImages is true, links to image files with extensions are treated as images
  const blocksWithImages = toMessageBlocks(text, { displayImages: true });
  expect(blocksWithImages[0].type).toBe("paragraph");
  expect(blocksWithImages[0].children[0].type).toBe("link");
  expect(blocksWithImages[0].children[0].url).toBe(
    "https://example.com/photo.jpg",
  );

  // When displayImages is false, should remain as regular links
  const blocksWithoutImages = toMessageBlocks(text, { displayImages: false });
  expect(blocksWithoutImages[0].type).toBe("paragraph");
  expect(blocksWithoutImages[0].children[0].type).toBe("link");
  expect(blocksWithoutImages[0].children[0].url).toBe(
    "https://example.com/photo.jpg",
  );
});

test("toMessageBlocks - referenced image", () => {
  const text =
    "![Referenced image][img1]\n\n[img1]: https://example.com/image.jpg";
  const blocks = toMessageBlocks(text);
  expect(blocks[0].type).toBe("image-grid");
  expect(blocks[0].children[0]).toEqual({
    type: "image",
    url: "https://example.com/image.jpg",
    alt: "Referenced image",
    interactive: false,
  });
});

test("toMessageBlocks - image with HTML entities in caption", () => {
  const text =
    '![Alt text](https://example.com/image.jpg "Caption with &amp; and &lt; entities")';
  const blocks = toMessageBlocks(text);
  expect(blocks[0].children[0].caption).toBe("Caption with & and < entities");
});
