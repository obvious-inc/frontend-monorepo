import { marked } from "marked";
import { getUserPerceivedCharacters } from "./string.js";
import { isEmoji } from "./emoji.js";

const isProduction = process.env.NODE_ENV === "production";

const fixUrl = (url) => {
  try {
    new URL(url);
    return url;
  } catch (e) {
    // I hate this
    return `http://${url}`;
  }
};

const commonHtmlEnties = {
  amp: "&",
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  quot: '"',
};

const decodeHtmlEntities = (string) => {
  const partiallyDecodedString = string
    .replace(/&#(\d+);/gi, (_, numStr) =>
      String.fromCharCode(parseInt(numStr, 10)),
    )
    .replace(
      /&([^;]+);/g,
      (match, entity) => commonHtmlEnties[entity] || match,
    );

  if (
    typeof document === "undefined" ||
    !partiallyDecodedString.match(/(&.+;)/gi)
  )
    return partiallyDecodedString;

  // textareas are magical
  const textareaEl = document.createElement("textarea");
  textareaEl.innerHTML = partiallyDecodedString;
  return textareaEl.value;
};

const parseChildren = (token, parse, context_ = {}) => {
  const { list, ...context } = context_;
  const children = list ? token.items : token.tokens;
  return children
    .filter((t) => t.type !== "space")
    .reduce((parsedChildren, token, index, tokens) => {
      const parsedChild = parse(token, {
        ...context,
        index,
        tokens,
        depth: context.depth + 1,
      });
      if (Array.isArray(parsedChild))
        return [...parsedChildren, ...parsedChild];
      return [...parsedChildren, parsedChild];
    }, []);
};

const parseToken = (token, context = {}) => {
  switch (token.type) {
    case "paragraph": {
      // Process all child tokens within this paragraph
      const children = parseChildren(token, parseToken, context);

      // Special case: If paragraph contains only a single text element that's all emoji
      if (children.length === 1 && children[0].type === "text") {
        // Extract individual characters as perceived by users (handles complex emoji)
        const maybeEmojiChars = getUserPerceivedCharacters(
          children[0].text.trim(),
        );
        // If all characters are emoji, convert to special emoji paragraph
        if (maybeEmojiChars.every(isEmoji))
          return {
            type: "paragraph",
            children: maybeEmojiChars.map((c) => ({
              type: "emoji",
              emoji: c,
            })),
          };
      }

      // Check if paragraph consists of only images or empty text
      const isImageParagraph = children.every(
        (t) => t.type === "image" || t.text?.trim() === "",
      );

      // If it's only images, convert to image grid
      if (isImageParagraph)
        return {
          type: "image-grid",
          children: children.filter((t) => t.type === "image"),
        };

      // If no images at all, return simple paragraph with all children
      if (!children.some((c) => c.type === "image"))
        return { type: "paragraph", children };

      // Handle mixed content (images and text) by organizing into alternating paragraphs and image grids
      return children.reduce((nodes, child) => {
        const lastNode = nodes[nodes.length - 1];
        if (child.type === "image") {
          // Image handling: group consecutive images into image-grid nodes
          if (lastNode?.type !== "image-grid") {
            // Start a new image grid if the last node wasn't one
            nodes.push({ type: "image-grid", children: [child] });
            return nodes;
          }
          // Add to existing image grid
          lastNode.children.push(child);
          return nodes;
        }

        // Text/other content handling: group into paragraph nodes
        if (lastNode?.type !== "paragraph") {
          // Start a new paragraph if the last node wasn't one
          nodes.push({
            type: "paragraph",
            // Avoid leading newlines when starting new paragraphs
            children: [
              {
                ...child,
                text:
                  child.text != null
                    ? child.text.replace(/^\n+/, "")
                    : undefined,
              },
            ],
          });
          return nodes;
        }
        // Add to existing paragraph
        lastNode.children.push(child);
        return nodes;
      }, []);
    }

    case "heading":
      return {
        type: `heading-${token.depth}`,
        children: parseChildren(token, parseToken, context),
      };

    case "list": {
      // Edge case pattern that is rarely intend as a list
      if (
        // Top level
        context.depth === 0 &&
        // Last block
        context.tokens.indexOf(token) === context.tokens.length - 1 &&
        // Single item list
        token.items.length === 1
      )
        return {
          type: "paragraph",
          children: [
            { type: "text", text: "- " },
            ...parseChildren(token.items[0], parseToken, context),
          ],
        };

      return {
        type: token.ordered ? "numbered-list" : "bulleted-list",
        start: token.start,
        children: parseChildren(token, parseToken, {
          ...context,
          list: true,
        }),
      };
    }

    case "list_item":
      return {
        type: "list-item",
        children: parseChildren(token, parseToken, {
          ...context,
          listMode: "normal", // token.loose ? "normal" : "simple",
        }),
      };

    case "blockquote":
      return {
        type: "quote",
        children: parseChildren(token, parseToken, context),
      };

    case "code":
      return {
        type: "code-block",
        lang: token.lang || null,
        code: token.text,
      };

    case "image": {
      if (context?.displayImages)
        return {
          type: "image",
          url: token.href,
          alt: token.text,
          caption:
            token.title == null ? undefined : decodeHtmlEntities(token.title),
          interactive: false,
        };

      if (context?.link) return { text: context.linkUrl };

      return { type: "link", url: token.href };
    }

    case "hr":
      return { type: "horizontal-divider" };

    case "table": {
      const children = [];

      const parseCell = (cell) =>
        cell.tokens.flatMap((t) => parseToken(t, context));

      if (token.header != null)
        children.push({
          type: "table-head",
          children: [
            {
              type: "table-row",
              children: token.header.map((cell) => ({
                type: "table-cell",
                children: parseCell(cell),
              })),
            },
          ],
        });

      children.push({
        type: "table-body",
        children: token.rows.map((row) => ({
          type: "table-row",
          children: row.map((cell) => ({
            type: "table-cell",
            children: parseCell(cell),
          })),
        })),
      });

      return {
        type: "table",
        children,
      };
    }

    case "link": {
      const isImageUrl = ["jpg", "png", "gif"].some((ext) =>
        token.href.endsWith(`.${ext}`),
      );

      const hasLabel = token.text !== token.href;

      const url = fixUrl(token.href);

      if (isImageUrl && !hasLabel && context?.displayImages)
        return { type: "image", url, interactive: false };

      const children = parseChildren(token, parseToken, {
        ...context,
        link: true,
        linkUrl: url,
      });

      if (children.some((n) => n.type === "image")) {
        const imageEl = children.find((n) => n.type === "image");
        // return { type: "image-grid", children: [{ ...imageEl, caption: url }] };
        return { ...imageEl, caption: url };
      }

      return {
        type: "link",
        url,
        children,
      };
    }

    case "codespan":
      return { type: "code", code: token.text };

    case "del": {
      // Don’t strikethrough single tildes
      if (token.raw.startsWith("~~"))
        return parseChildren(token, parseToken, {
          ...context,
          strikethrough: true,
        });

      return [
        { type: "text", text: "~" },
        ...parseChildren(token, parseToken, context),
        { type: "text", text: "~" },
      ];
    }

    case "strong":
      return parseChildren(token, parseToken, { ...context, bold: true });

    case "em":
      return parseChildren(token, parseToken, { ...context, italic: true });

    case "ins":
      return parseChildren(token, parseToken, { ...context, underline: true });

    case "br":
      return { type: "text", text: "\n" };

    case "escape":
      return { type: "text", text: token.text };

    case "text": {
      if (token.tokens != null) {
        const { listMode, ...context_ } = context;
        const children = parseChildren(token, parseToken, context_);
        if (listMode == null || listMode === "simple") return children;
        return { type: "paragraph", children };
      }

      const el = {
        type: "text",
        text: decodeHtmlEntities(token.text),
      };

      if (context?.bold) el.bold = true;
      if (context?.italic) el.italic = true;
      if (context?.strikethrough) el.strikethrough = true;
      if (context?.underline) el.underline = true;
      return el;
    }

    case "space":
      return null;

    case "html":
      if (!token.block) return { type: "text", text: token.text };
      return {
        type: "paragraph",
        children: [{ type: "text", text: token.text }],
      };

    default:
      if (isProduction) return null;
      throw new Error(`Unknown token "${token.type}"`);
  }
};

// https://www.markdownguide.org/hacks/#underline
const insExtension = {
  name: "ins",
  level: "inline",
  start(src) {
    return src.indexOf("<ins>");
  },
  tokenizer(src) {
    const match = src.match(/^<ins>(.*?)<\/ins>/);

    if (match) {
      return {
        type: "ins",
        raw: match[0],
        text: match[1],
        tokens: [{ type: "text", raw: match[1], text: match[1] }],
      };
    }

    return;
  },
};

marked.use({ extensions: [insExtension] });

export const toMessageBlocks = (text, { displayImages = true } = {}) => {
  const tokens = marked.lexer(text);
  return tokens
    .filter((t) => t.type !== "space")
    .flatMap((token, index, tokens) =>
      parseToken(token, {
        displayImages,
        index,
        tokens,
        depth: 0,
      }),
    );
};

export const getFirstParagraph = (string) => {
  const blocks = string.split("\n");
  const firstParagraph = blocks.find((line_) => {
    const line = line_.trim();
    return (
      line !== "" &&
      ["#", "-", "*", "!", "[", "`"].every((token) => !line.startsWith(token))
    );
  });
  return firstParagraph ?? blocks[0];
};

export const blockquote = (string) =>
  string
    // https://www.unicode.org/reports/tr18/#Line_Boundaries
    .split(/(\r\n|(?!\r\n)[\n-\r\x85\u2028\u2029])/)
    .reduce((acc, part, i, parts) => {
      if (i % 2 !== 0) return acc; // break part
      const [line, breakCharacters] = [part, parts[i + 1]];
      if (breakCharacters != null) return acc + "> " + line + breakCharacters;
      if (line === "") return acc;
      return acc + "> " + line;
    }, "");

// This will throw if the input isn’t a valid blockquote string
export const unquote = (markdownBlockquote) =>
  markdownBlockquote
    // https://www.unicode.org/reports/tr18/#Line_Boundaries
    .split(/(\r\n|(?!\r\n)[\n-\r\x85\u2028\u2029])/)
    .reduce((acc, part, i, parts) => {
      if (i % 2 !== 0) return acc; // break part
      const [line, breakCharacters] = [part, parts[i + 1]];
      if (line[0] !== ">") throw new Error("invalid blockquote");

      const unquotedLine = line[1] === " " ? line.slice(2) : line.slice(1);
      if (breakCharacters != null) return acc + unquotedLine + breakCharacters;
      if (unquotedLine === "") return acc;
      return acc + unquotedLine;
    }, "");

export const getFirstImage = (text) => {
  const blocks = toMessageBlocks(text);

  const flattenBlocks = (blocks) =>
    blocks.flatMap((block) =>
      block.children ? [block, ...flattenBlocks(block.children)] : [block],
    );

  return flattenBlocks(blocks).find((block) => block.type === "image");
};
