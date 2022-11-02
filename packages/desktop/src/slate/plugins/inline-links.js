import { url as urlUtils } from "@shades/common/utils";
import { Editor, Transforms, Point, Text } from "slate";

const wrapLink = (editor, url, { at } = {}) => {
  const parsedUrl = new URL(url);
  const link = { type: "link", url: parsedUrl.href, children: [] };
  Transforms.wrapNodes(editor, link, { at, split: true });
};

const getWords = ([node, path]) => {
  if (!Text.isText(node)) return [];

  let offset = 0;
  const wordEntries = [];

  for (let wordString of node.text.split(/\s+/)) {
    if (wordString === "") {
      offset += 1;
      continue;
    }

    wordEntries.push([
      wordString,
      {
        anchor: { path, offset },
        focus: { path, offset: offset + wordString.length },
      },
    ]);

    offset += wordString.length + 1;
  }

  return wordEntries;
};

const createMiddleware = ({ isUrl }) => {
  return (editor) => {
    const { isInline, insertText, normalizeNode } = editor;

    const normalizeLinkChildren = () => {
      // TODO
    };

    const normalizeLinkNode = ([node, path]) => {
      const linkStringContent = Editor.string(
        editor,
        Editor.range(editor, ...Editor.edges(editor, path))
      );

      if (!isUrl(linkStringContent)) {
        Transforms.unwrapNodes(editor, {
          at: path,
          match: (n) => n.type === "link",
          split: true,
        });
        return;
      }

      const url = new URL(linkStringContent);

      if (url.href !== node.url) {
        Transforms.setNodes(editor, { url: url.href }, { at: path });
        return;
      }

      normalizeLinkChildren([node, path]);

      normalizeNode([node, path]);
      return;
    };

    editor.isInline = (element) => element.type === "link" || isInline(element);

    editor.normalizeNode = ([node, path]) => {
      if (node.type === "link") {
        normalizeLinkNode([node, path]);
        return;
      }

      if (!Text.isText(node)) {
        normalizeNode([node, path]);
        return;
      }

      // Wrap urls in link nodes
      const urlEntries = getWords([node, path]).filter(([word]) => isUrl(word));

      for (let [url, urlRange] of urlEntries) {
        const match = Editor.above(editor, {
          at: urlRange,
          match: (n) => n.type === "link",
        });

        // Url already wrapped in a link
        if (match) continue;

        wrapLink(editor, url, { at: urlRange });
      }

      normalizeNode([node, path]);
    };

    editor.insertText = (text) => {
      const { selection } = editor;

      const match = Editor.above(editor, {
        match: (n) => n.type === "link",
      });

      if (!match) {
        insertText(text);
        return;
      }

      const linkEndPoint = Editor.end(editor, match[1]);

      // Move cursor out of the node when pressing "space" at the end of a link
      if (text === " " && Point.equals(selection.anchor, linkEndPoint))
        Transforms.move(editor, { distance: 1, unit: "offset" });

      insertText(text);
    };

    return editor;
  };
};

const LinkComponent = ({ attributes, children, element }) => (
  <a {...attributes} href={element.url}>
    {children}
  </a>
);

export default ({ isUrl = urlUtils.validate } = {}) => ({
  middleware: createMiddleware({ isUrl }),
  elements: { link: LinkComponent },
});
