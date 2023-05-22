import { Editor, Path, Point, Text, Element, Range, Transforms } from "slate";
import { function as functionUtils } from "@shades/common/utils";

const { compose } = functionUtils;

export const mergePlugins = (plugins) => {
  const middleware = compose(
    ...plugins.filter((p) => p.middleware != null).map((p) => p.middleware)
  );

  const elements = plugins.reduce(
    (acc, p) => (p.elements == null ? acc : { ...acc, ...p.elements }),
    []
  );

  const pipeEventHandler =
    (handler) =>
    (e, ...rest) => {
      handler?.(e, ...rest);
      return e;
    };

  const handlers = {
    onChange: compose(
      ...plugins.map((p) => pipeEventHandler(p.handlers?.onChange))
    ),
    onKeyDown: compose(
      ...plugins.map((p) => pipeEventHandler(p.handlers?.onKeyDown))
    ),
  };

  return { middleware, elements, handlers };
};

export const isNodeEmpty = (el) => {
  if (el.type === "user") return false;
  if (el.type === "channel-link") return false;
  if (el.type === "attachments") return false;
  if (el.type === "link") return false;
  if (el.type === "emoji") return false;
  if (el.children != null) return el.children.every(isNodeEmpty);
  return el.text.trim() === "";
};

export const toMessageBlocks = (nodes) =>
  nodes.map((n) => {
    if (n.type === "link") return { type: "link", url: n.url };
    if (n.type === "emoji") return { type: "emoji", emoji: n.emoji };
    if (n.type === "user") return { type: "user", ref: n.ref };
    if (n.type === "channel-link") return { type: "channel-link", ref: n.ref };
    if (n.children == null) return n;
    return { ...n, children: toMessageBlocks(n.children) };
  });

export const parseMessageBlocks = (blocks) =>
  blocks.reduce((acc, n) => {
    if (n.type === "link")
      return [
        ...acc,
        { text: "" },
        { ...n, children: [{ text: n.url }] },
        { text: "" },
      ];
    if (n.type === "emoji")
      return [
        ...acc,
        { text: "" },
        { ...n, children: [{ text: n.emoji }] },
        { text: "" },
      ];
    if (n.type === "user" || n.type === "channel-link")
      return [
        ...acc,
        { text: "" },
        { ...n, children: [{ text: "" }] },
        { text: "" },
      ];
    // TODO implement plugin "unsupported-element"
    if (n.children == null && n.text == null)
      return [...acc, { ...n, text: "" }];
    if (n.children == null) return [...acc, n];
    return [...acc, { ...n, children: parseMessageBlocks(n.children) }];
  }, []);

export const search = (editor, query, options = {}) => {
  const at = options.at ?? editor.selection ?? [];

  const [atStart, atEnd] = Editor.edges(editor, at);

  let start, end;

  let text = "";

  for (const [node, path] of Editor.nodes(editor, {
    at,
    match: Text.isText,
  })) {
    let t = node.text;

    if (Path.equals(path, atEnd.path)) t = t.slice(0, atEnd.offset);
    if (Path.equals(path, atStart.path)) t = t.slice(atStart.offset);

    const prevLength = text.length;

    text = text + t;

    const index = text.indexOf(query);

    if (index !== -1) {
      const offset = index - prevLength + query.length;
      end = { path, offset };
      break;
    }
  }

  if (end == null) return null;

  text = "";

  for (const [node, path] of Editor.nodes(editor, {
    at: { anchor: atStart, focus: end },
    match: Text.isText,
    reverse: true,
  })) {
    let t = node.text;

    if (Path.equals(path, atEnd.path)) t = t.slice(0, atEnd.offset);
    if (Path.equals(path, atStart.path)) t = t.slice(atStart.offset);

    text = t + text;

    const index = text.indexOf(query);

    if (index !== -1) {
      start = { path, offset: index };
      break;
    }
  }

  return [start, end];
};

export const getWords = ([node, path]) => {
  if (!Text.isText(node)) return [];

  let offset = 0;
  const wordEntries = [];

  for (const wordString of node.text.split(/\s+/)) {
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

export const getCharacters = ([node, path]) => {
  if (!Text.isText(node)) return [];

  let offset = 0;
  const characterEntries = [];

  for (const charString of [...node.text]) {
    characterEntries.push([
      charString,
      {
        anchor: { path, offset },
        focus: { path, offset: offset + charString.length },
      },
    ]);

    offset += charString.length;
  }

  return characterEntries;
};

export const intersectsSelection = (editor, nodePath) => {
  if (editor.selection == null) return false;

  const [nodeStartPoint, nodeEndPoint] = Editor.edges(editor, nodePath);
  return Range.includes(
    { anchor: nodeStartPoint, focus: nodeEndPoint },
    editor.selection
  );
};

export const withBlockPrefixShortcut = (
  { prefix, elementType, afterTransform },
  editor
) => {
  const { insertText } = editor;

  editor.insertText = (text) => {
    const { selection } = editor;

    if (!text.endsWith(" ") || !selection || !Range.isCollapsed(selection)) {
      insertText(text);
      return;
    }

    const blockEntry = Editor.above(editor, {
      match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
    });

    if (blockEntry == null || blockEntry[0].type === elementType) {
      insertText(text);
      return;
    }

    const range = {
      anchor: selection.anchor,
      focus: Editor.start(editor, blockEntry[1]),
    };
    const prefixText =
      Editor.string(editor, range, { voids: true }) + text.slice(0, -1);

    const isMatch = Array.isArray(prefix)
      ? prefix.includes(prefixText)
      : prefixText === prefix;

    if (!isMatch) {
      insertText(text);
      return;
    }

    Transforms.select(editor, range);

    if (!Range.isCollapsed(range)) {
      Transforms.delete(editor);
    }

    Transforms.setNodes(
      editor,
      { type: elementType },
      { match: (n) => Element.isElement(n) && Editor.isBlock(editor, n) }
    );

    afterTransform?.({ prefix: prefixText });
  };

  return editor;
};

export const withEmptyBlockBackwardDeleteTransform = (
  { fromElementType, toElementType },
  editor
) => {
  const { deleteBackward } = editor;

  editor.deleteBackward = (...args) => {
    const { selection } = editor;

    if (!selection || !Range.isCollapsed(selection)) {
      deleteBackward(...args);
      return;
    }

    const match = Editor.above(editor, {
      match: (n) => Element.isElement(n) && Editor.isBlock(editor, n),
    });

    if (match == null) {
      deleteBackward(...args);
      return;
    }

    const [block, path] = match;
    const start = Editor.start(editor, path);

    const isMatchingBlockType = Array.isArray(fromElementType)
      ? fromElementType.includes(block.type)
      : fromElementType === block.type;

    if (
      !Editor.isEditor(block) &&
      Element.isElement(block) &&
      isMatchingBlockType &&
      Point.equals(selection.anchor, start)
    ) {
      Transforms.setNodes(editor, { type: toElementType });
      return;
    }

    deleteBackward(...args);
  };

  return editor;
};
