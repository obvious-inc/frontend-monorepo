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
    if (node.children != null) node.children = map(node.children, fn);
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

const isNodeEmpty = (node, options = {}) => {
  const { trim = false } = options;

  if (node.text != null)
    return trim ? node.text.trim() === "" : node.text === "";

  switch (node.type) {
    case "user":
    case "channel-link":
    case "image":
    case "horizontal-divider":
      return false;

    default:
      return node.children.every((n) => isNodeEmpty(n, options));
  }
};

export const isEmpty = (nodes, options) =>
  nodes.every((n) => isNodeEmpty(n, options));

const isNodeEqual = (n1, n2) => {
  if (n1.type !== n2.type) return false;

  // Text nodes
  if (n1.text != null)
    return ["text", "bold", "italic", "strikethrough"].every(
      (p) => n1[p] === n2[p]
    );

  // The rest is for element nodes

  const baseEqual = () => {
    const [cs1, cs2] = [n1, n2].map((n) =>
      n.children.filter((n) => !isNodeEmpty(n))
    );

    if (cs1.length !== cs2.length) return false;

    return cs1.every((node1, i) => {
      const node2 = cs2[i];
      return isNodeEqual(node1, node2);
    });
  };

  const propertiesEqual = (ps) => ps.every((p) => n1[p] === n2[p]);

  switch (n1.type) {
    case "link":
      return propertiesEqual(["url", "label"]) && baseEqual();

    case "user":
      return propertiesEqual(["ref"]);

    case "channel-link":
      return propertiesEqual(["ref"]);

    case "emoji":
      return propertiesEqual(["emoji"]);

    case "image":
    case "image-attachment":
      return propertiesEqual(["url"]);

    case "horizontal-divider":
      return n1.type === n2.type;

    default:
      return baseEqual();
  }
};

export const isEqual = (ns1, ns2) =>
  isNodeEqual({ type: "root", children: ns1 }, { type: "root", children: ns2 });

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

          if (validateUrl(word)) {
            if (prev != null) prev.text = `${prev.text} `;
            const url = new URL(word);
            return [...els, { type: "link", url: url.href }];
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
  { humanReadable = true, renderUser, renderChannelLink } = {}
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
        return `\n${stringifyChildren()}\n`;

      case "image-attachment":
        return humanReadable ? el.url : "";

      case "horizontal-divider":
        return "\n---\n";

      default:
        throw new Error();
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

export const toMarkdown = (blockElements) => {
  const renderTextNode = (l) => {
    let text = l.text;

    if (l.bold) text = `**${text}**`;
    if (l.italic) text = `*${text}*`;
    if (l.strikethrough) text = `~~${text}~~`;
    return text;
  };

  const renderElement = (el) => {
    const renderChildren = () => el.children.map(renderNode).join("");

    switch (el.type) {
      case "paragraph":
      case "list-item":
        return `${renderChildren()}`;

      case "heading-1":
        return `\n# ${renderChildren()}\n`;
      case "heading-2":
        return `\n## ${renderChildren()}\n`;
      case "heading-3":
        return `\n### ${renderChildren()}\n`;
      case "heading-4":
        return `\n#### ${renderChildren()}\n`;

      case "quote":
      case "callout":
        return `\n> ${renderChildren()}\n`;

      case "bulleted-list":
      case "numbered-list": {
        const isBulletList = el.type === "bulleted-list";
        const children = el.children.map((el, i) => {
          const prefix = isBulletList ? "-" : `${i + 1}.`;
          return `${prefix} ${renderNode(el)}`;
        });
        return `\n${children.join("\n")}\n`;
      }

      case "link":
        return `[${el.text ?? el.url}](${el.url})`;

      case "emoji":
        return el.emoji;

      case "attachments":
        return `\n${renderChildren()}\n`;

      case "image-attachment":
        return `![](${el.url})`;

      case "horizontal-divider":
        return "\n---\n";

      default:
        throw new Error();
    }
  };

  const renderNode = (n) => {
    if (n.text != null) return renderTextNode(n);
    return renderElement(n);
  };

  return (
    blockElements
      .map(renderElement)
      .join("")
      // Gets rid of the the outer paragraph line breaks, I dunno
      .replace(/^[\n]|[\n]$/g, "")
  );
};

export const createParagraphElement = (content = "") => ({
  type: "paragraph",
  children: typeof content === "string" ? [{ text: content }] : content,
});

export const createEmptyParagraphElement = () => createParagraphElement();
