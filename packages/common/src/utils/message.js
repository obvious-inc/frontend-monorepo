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

const stringifyTextNode = (l) => {
  let text = l.text;
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
    case "user":
      // TODO
      return `@<u:${el.ref}>`;
    case "link":
      return el.url;
    case "attachments":
    case "image-attachment":
      return "";
    default:
      throw new Error();
  }
};

const stringifyNode = (n) => {
  if (n.text != null) return stringifyTextNode(n);
  return stringifyElement(n);
};

export const stringifyBlocks = (blockElements) =>
  blockElements
    .map(stringifyElement)
    .join("")
    // Gets rid of the the outer paragraph line breaks, I dunno
    .replace(/^[\n]|[\n]$/g, "");
