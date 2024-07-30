import { validate as validateUrl } from "./url.js";

export const iterate = (fn, nodes) => {
  for (let node of nodes) {
    fn(node);
    if (node.children == null) continue;
    iterate(fn, node.children);
  }
};

export const map = (fn, nodes) => {
  const mappedNodes = [];

  for (let [index, node] of nodes.entries()) {
    if (node.children != null) node.children = map(fn, node.children);
    mappedNodes.push(fn(node, index));
  }

  return mappedNodes;
};

export const filter = (predicate, nodes) => {
  const filteredNodes = [];

  for (let [index, node] of nodes.entries()) {
    if (node.children != null)
      node = { ...node, children: filter(predicate, node.children) };
    if (!predicate(node, index)) continue;
    filteredNodes.push(node);
  }

  return filteredNodes;
};

export const some = (predicate, nodes) => {
  for (let node of nodes) {
    if (predicate(node)) return true;
    if (node.children == null) continue;
    return some(predicate, node.children);
  }
  return false;
};

export const every = (predicate, nodes) => {
  for (let node of nodes) {
    if (!predicate(node)) return false;
    if (node.children == null) continue;
    return every(predicate, node.children);
  }
  return true;
};

export const isEmpty = (node, options = {}) => {
  if (Array.isArray(node)) return node.every((n) => isEmpty(n, options));

  const { trim = false } = options;

  if (node.text != null)
    return trim ? node.text.trim() === "" : node.text === "";

  switch (node.type) {
    case "emoji":
    case "link":
    case "user":
    case "channel-link":
    case "image":
    case "horizontal-divider":
      return false;

    case "code-block":
      return node.code.trim() === "";

    default:
      return node.children.every((n) => isEmpty(n, options));
  }
};

export const isEqual = (ns1, ns2, options = {}) => {
  if (ns1 == null || ns2 == null) return ns1 == ns2;

  const { filterEmpty = false } = options;

  if (Array.isArray(ns1)) {
    if (!Array.isArray(ns2)) return false;

    const [ns1_, ns2_] = [ns1, ns2].map((ns) =>
      filterEmpty ? ns.filter((n) => !isEmpty(n)) : ns,
    );

    if (ns1_.length !== ns2_.length) return false;
    return ns1_.every((n1, i) => {
      const n2 = ns2_[i];
      return isEqual(n1, n2, options);
    });
  }

  const [n1, n2] = [ns1, ns2];

  if (n1.type !== n2.type) return false;

  // Text nodes
  if (n1.text != null)
    return ["text", "bold", "italic", "strikethrough"].every(
      (p) => n1[p] === n2[p],
    );

  // The rest is for element nodes
  const childrenEqual = () => isEqual(n1.children, n2.children, options);
  const propertiesEqual = (ps) =>
    ps.every((p) => (n1[p] ?? null) === (n2[p] ?? null));

  switch (n1.type) {
    case "link":
      return propertiesEqual(["url", "label"]);

    case "user":
      return propertiesEqual(["ref"]);

    case "channel-link":
      return propertiesEqual(["ref"]);

    case "emoji":
      return propertiesEqual(["emoji"]);

    case "image":
    case "image-attachment":
      return propertiesEqual(["url", "caption"]);

    case "horizontal-divider":
      return n1.type === n2.type;

    default:
      return childrenEqual();
  }
};

export const getMentions = (nodes) => {
  const mentions = [];

  iterate((node) => {
    if (node.type === "user") mentions.push(node);
  }, nodes);

  return mentions;
};

export const withoutAttachments = (nodes) =>
  filter((n) => n.type !== "attachments", nodes);

export const parseString = (string) => {
  if (string.trim() === "") return [];

  const paragraphStrings = string.split(/^\s*$/m).map((s) => s.trim());

  const paragraphElements = paragraphStrings.map((paragraphString) => {
    const paragraphChildren = paragraphString
      .split(/\n/)
      .reduce((paragraphElements, line, i, lines) => {
        const isLastLine = i === lines.length - 1;

        const lineElements = line.split(/\s+/).reduce((els, word) => {
          const prev = els[els.length - 1];

          const isValidUrl = validateUrl(word);

          if (isValidUrl) {
            const disalloedEndCharacters = [".", ",", ";", ")"];
            let cleanedUrl = word;
            let trailingPart = "";
            while (
              disalloedEndCharacters.includes(cleanedUrl[cleanedUrl.length - 1])
            ) {
              trailingPart = cleanedUrl[cleanedUrl.length - 1] + trailingPart;
              cleanedUrl = cleanedUrl.slice(0, -1);
            }

            if (prev != null) prev.text = `${prev.text} `;
            const url = new URL(cleanedUrl);
            const linkEl = { type: "link", url: url.href };
            if (trailingPart === "") return [...els, linkEl];
            return [...els, linkEl, { text: trailingPart }];
          }

          if (prev == null || prev.type === "link")
            return [...els, { text: prev == null ? word : ` ${word}` }];

          prev.text = `${prev.text} ${word}`;

          return els;
        }, []);

        if (isLastLine) return [...paragraphElements, ...lineElements];

        return [...paragraphElements, ...lineElements, { text: "\n" }];
      }, []);

    return createParagraphElement(paragraphChildren);
  });

  return paragraphElements;
};

export const stringifyBlocks = (
  blockElements,
  { humanReadable = true, renderUser, renderChannelLink } = {},
) => {
  const stringifyTextNode = (l) => {
    let text = l.text;

    if (humanReadable) return l.strikethrough ? `~${text}~` : text;

    if (l.bold) text = `*${text}*`;
    if (l.italic) text = `_${text}_`;
    if (l.strikethrough) text = `~${text}~`;
    return text;
  };

  const stringifyElement = (el) => {
    const stringifyChildren = () => el.children.map(stringifyNode).join("");

    switch (el.type) {
      case "paragraph":
      case "heading-1":
      case "heading-2":
      case "list-item":
        return `\n${stringifyChildren()}\n`;

      case "quote":
      case "callout":
        return `\n> ${stringifyChildren()}\n`;

      case "bulleted-list":
      case "numbered-list": {
        const children = el.children.map((el, i) => {
          const prefix = el.type === "bulleted-list" ? "-" : `${i + 1}.`;
          return `${prefix} ${stringifyNode(el)}`;
        });
        return `\n${children.join("\n")}\n`;
      }

      case "user": {
        if (!humanReadable) return `@<u:${el.ref}>`;
        return renderUser(el.ref);
      }

      case "channel-link": {
        if (!humanReadable) return `@<c:${el.ref}>`;
        return renderChannelLink(el.ref);
      }

      case "link":
        return el.url;

      case "emoji":
        return el.emoji;

      case "attachments":
      case "image-grid":
        return `\n${stringifyChildren()}\n`;

      case "image":
      case "image-attachment":
        return humanReadable ? el.url : "";

      case "horizontal-divider":
        return "\n---\n";

      case "code-block":
        return `\n\`\`\`${el.code}\`\`\`\n`;

      case "code":
        return `\`${el.code}\``;

      default:
        throw new Error(`Unsupported element type "${el.type}"`);
    }
  };

  const stringifyNode = (n) => {
    if (n.text != null) return stringifyTextNode(n);
    return stringifyElement(n);
  };

  return (
    blockElements
      .map(stringifyElement)
      .join("")
      // Gets rid of the the outer paragraph line breaks, I dunno
      .replace(/^[\n]|[\n]$/g, "")
  );
};

// const escapableCharacters = [
//   "\\",
//   "*",
//   "_",
//   "`",
//   "(",
//   ")",
//   "[",
//   "]",
//   "{",
//   "}",
//   "<",
//   ">",
//   "#",
//   "+",
//   "-",
//   ".",
//   "|",
//   "!",
// ];

const escapeMarkdown = (string) => {
  let escaped = string;

  for (const char of ["*", "_", "`", "~"]) {
    const regexp = new RegExp(`\\${char}`, "g");
    escaped = escaped.replace(regexp, `\\${char}`);
  }

  return escaped;
};

export const toMarkdown = (blockElements) => {
  const renderTextNode = (l) => {
    let text = escapeMarkdown(l.text);

    if (l.bold) text = `**${text}**`;
    if (l.italic) text = `*${text}*`;
    if (l.strikethrough) text = `~~${text}~~`;
    return text;
  };

  const renderBlockElement = (el) => {
    const renderInlineChildren = () => el.children.map(renderNode).join("");

    switch (el.type) {
      case "paragraph":
        return renderInlineChildren();

      case "heading-1":
        return `# ${renderInlineChildren()}`;
      case "heading-2":
        return `## ${renderInlineChildren()}`;
      case "heading-3":
        return `### ${renderInlineChildren()}`;
      case "heading-4":
        return `#### ${renderInlineChildren()}`;
      case "heading-5":
        return `##### ${renderInlineChildren()}`;
      case "heading-6":
        return `###### ${renderInlineChildren()}`;

      case "quote":
      case "callout":
        // Block children
        if (el.children[0].children != null)
          return el.children
            .map(renderBlockElement)
            .join("\n\n")
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n");

        return `> ${renderInlineChildren().trim().split("\n").join("\n> ")}`;

      case "bulleted-list":
      case "numbered-list": {
        const isBulletList = el.type === "bulleted-list";

        const children = el.children.map((el, i) => {
          const listItemPrefix = isBulletList ? "-" : `${i + 1}.`;
          const renderedListItemChildBlocks = el.children.map((c) => {
            if (!c.type) return "";
            return renderBlockElement(c);
          });

          const indentSpace = "".padStart(listItemPrefix.length + 1, " ");

          // Special case to make simple nested lists look bit nicer
          const skipBlockSpace =
            el.children.length === 2 &&
            el.children[0].type === "paragraph" &&
            ["bulleted-list", "numbered-list"].includes(el.children[1].type);

          return `${listItemPrefix} ${renderedListItemChildBlocks
            .filter((s) => s.trim() !== "")
            .join(skipBlockSpace ? "\n" : "\n\n")} `
            .split("\n")
            .join(`\n${indentSpace}`);
        });

        return children.join("\n");
      }

      case "image-grid":
      case "attachments":
        return el.children.map(renderBlockElement).join("\n");

      case "image": {
        const alt = el.alt || "";

        if (el.caption == null || el.caption.trim() === "")
          return `![${alt}](${el.url})`;

        try {
          new URL(el.caption);
          return `[![${alt}](${el.url} ${JSON.stringify(el.caption)})](${el.caption})`;
        } catch (e) {
          return `![${alt}](${el.url} ${JSON.stringify(el.caption)})`;
        }
      }

      case "horizontal-divider":
        return "---";

      case "code-block":
        return `\`\`\`\n${el.code}\n\`\`\``;

      case "table": {
        const header = el.children.find((el) => el.type === "table-head");
        const body = el.children.find((el) => el.type === "table-body");

        const rows = [
          ...(header?.children ?? []),
          ...(body?.children ?? []),
        ].map((rowEl) =>
          rowEl.children.map((cellEl) =>
            cellEl.children.map(renderNode).join(""),
          ),
        );

        const columnWidths = rows.reduce((widths, cells) => {
          cells.forEach((cell, i) => {
            widths[i] = Math.max(widths[i] ?? 0, cell.length);
          });
          return widths;
        }, []);

        const renderRow = (cells) =>
          `| ${cells
            .map((text, i) => text.padEnd(columnWidths[i], " "))
            .join(" | ")} |`;

        const table = rows.map(renderRow).join("\n");

        if (header == null) return table;

        const renderedRows = table.split("\n");

        return [
          renderedRows[0],
          // Header bottom divider
          `| ${columnWidths
            .map((width) => "".padEnd(width, "-"))
            .join(" | ")} |`,
          ...renderedRows.slice(1),
        ].join("\n");
      }

      default:
        throw new Error(`Unknown element type: "${el.type}"`);
    }
  };

  const renderNode = (node, i, all) => {
    if (node.type == null || node.type === "text")
      return renderTextNode(node, i, all);

    switch (node.type) {
      case "image":
        return node.caption == null
          ? `![${node.alt}](${node.url})`
          : `![${node.alt}](${node.url} "${node.caption}")`;

      case "link":
        return `[${node.label ?? node.text ?? node.url}](${node.url})`;

      case "emoji":
        return node.emoji;

      default:
        throw new Error(`Unknown node type: "${node.type}"`);
    }
  };

  return blockElements
    .map(renderBlockElement)
    .filter((s) => s.trim() !== "")
    .join("\n\n");
};

export const createParagraphElement = (content = "") => ({
  type: "paragraph",
  children: typeof content === "string" ? [{ text: content }] : content,
});

export const createEmptyParagraphElement = () => createParagraphElement();
