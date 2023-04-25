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
    if (node.children != null) node.children = filter(predicate, node.children);
    if (!predicate(node, index)) continue;
    filteredNodes.push(node);
  }

  return filteredNodes;
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

  const paragraphStrings = string.split(/^\s*$/m);

  const paragraphElements = paragraphStrings.map((paragraphString) => {
    const words = paragraphString.split(" ");

    const paragraphChildren = words.reduce((els, word) => {
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
    const children = () => el.children.map(stringifyNode).join("");

    switch (el.type) {
      case "paragraph":
        return `\n${children()}\n`;
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
        return `\n${children()}\n`;
      case "image-attachment":
        return humanReadable ? el.url : "";
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

export const createParagraphElement = (content = "") => ({
  type: "paragraph",
  children: typeof content === "string" ? [{ text: content }] : content,
});

export const createEmptyParagraphElement = () => createParagraphElement();
