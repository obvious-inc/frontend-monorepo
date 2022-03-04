const stringifyTextNode = (l) => {
  let text = l.text;
  if (l.bold) text = `*${text}*`;
  if (l.italic) text = `_${text}_`;
  if (l.strikethrough) text = `~${text}~`;
  return text;
};

const stringifyElement = (el) => {
  const children = el.children.map(stringifyNode).join("");

  switch (el.type) {
    case "paragraph":
      return `\n${children}\n`;
    case "link":
      return el.url;
    default:
      throw new Error();
  }
};

const stringifyNode = (n) => {
  if (n.text != null) return stringifyTextNode(n);
  return stringifyElement(n);
};

const stringify = (blockElements) =>
  // `trim` to get rid of the the outer paragraph line breaks, I dunno
  blockElements.map(stringifyElement).join("").trim();

export default stringify;
