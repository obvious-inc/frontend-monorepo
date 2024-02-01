import { Editor, Node, Path, Point, Text, Element, Range } from "slate";
import { function as functionUtils } from "@shades/common/utils";

const { compose } = functionUtils;

export const mergePlugins = (plugins) => {
  const middleware = compose(
    ...plugins
      .filter((p) => p.middleware != null)
      .map((p) => p.middleware)
      .reverse()
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

// TODO: move to element specific plugins
export const isNodeEmpty = (el, options = {}) => {
  const { trim = true } = options;

  switch (el.type) {
    case "user":
    case "channel-link":
    case "attachments":
    case "image-attachment":
    case "image":
    case "link":
    case "emoji":
    case "code":
      return false;

    case "code-block":
      return el.children[0].text.trim() === "";

    default: {
      if (el.text != null) return trim ? el.text.trim() === "" : el.text === "";
      return el.children.every((n) => isNodeEmpty(n, options));
    }
  }
};

// TODO: move to element specific plugins
export const toMessageBlocks = (nodes) => {
  const stringify = (n) => {
    if (n.children == null) return n.text;
    return n.children.map(stringify).join("");
  };

  return nodes.map((n) => {
    if (n.type == null) return n;

    if (n.type === "code-block")
      return { type: "code-block", code: n.children[0].text };
    if (n.type === "table") return { type: "table", children: n.content };
    if (n.type === "link")
      return {
        type: "link",
        url: n.url,
        label: n.label ?? n.children[0]?.text,
      };
    if (n.type === "emoji") return { type: "emoji", emoji: n.emoji };
    if (n.type === "user") return { type: "user", ref: n.ref };
    if (n.type === "channel-link") return { type: "channel-link", ref: n.ref };
    if (n.type === "horizontal-divider") return { type: n.type };

    if (n.type.startsWith("heading-")) {
      // Merge content into a single child
      return { type: n.type, children: [{ text: stringify(n) }] };
    }

    if (n.children == null) return n;

    const children = toMessageBlocks(n.children);

    return {
      ...n,
      children:
        n.children.length === 1
          ? children
          : children.filter((n) => !isNodeEmpty(n, { trim: false })),
    };
  });
};

// TODO: move to element specific plugins
export const fromMessageBlocks = (blocks) =>
  blocks.reduce((acc, n) => {
    if (n.type === "code-block")
      return [...acc, { ...n, children: [{ text: n.code }] }];

    if (n.type === "table")
      return [...acc, { ...n, content: n.children, children: [{ text: "" }] }];

    if (n.type === "code") return [...acc, { text: `\`${n.code}\`` }];

    if (n.type === "link")
      return [
        ...acc,
        { text: "" },
        {
          ...n,
          children:
            n.label == null
              ? fromMessageBlocks(n.children)
              : [{ text: n.label }],
        },
        { text: "" },
      ];

    if (n.type === "emoji")
      return [
        ...acc,
        { text: "" },
        { ...n, children: [{ text: n.emoji }] },
        { text: "" },
      ];

    // Inline voids
    if (["user", "channel-link"].includes(n.type))
      return [
        ...acc,
        { text: "" },
        { ...n, children: [{ text: "" }] },
        { text: "" },
      ];

    // Block voids
    if (["horizontal-divider"].includes(n.type))
      return [...acc, { ...n, children: [{ text: "" }] }];

    if (n.type === "image") return [...acc, { ...n, children: [{ text: "" }] }];

    // TODO implement plugin "unsupported-element"
    if (n.children == null && n.text == null)
      return [...acc, { ...n, text: "" }];

    if (n.children == null) return [...acc, n];

    const children = fromMessageBlocks(n.children);
    const nonEmptyChildren = children.length === 0 ? [{ text: "" }] : children;

    return [...acc, { ...n, children: nonEmptyChildren }];
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
  { prefix, elementType, instant = false, transform, afterTransform },
  editor
) => {
  const { insertText } = editor;

  editor.insertText = (text) => {
    const { selection } = editor;

    if (
      (!instant && !text.endsWith(" ")) ||
      !selection ||
      !Range.isCollapsed(selection)
    ) {
      insertText(text);
      return;
    }

    const blockEntry = editor.above({
      match: (n) => Element.isElement(n) && editor.isBlock(n),
    });

    if (blockEntry == null || blockEntry[0].type !== "paragraph") {
      insertText(text);
      return;
    }

    const prefixRange = {
      anchor: selection.anchor,
      focus: editor.start(blockEntry[1]),
    };
    const prefixText =
      editor.string(prefixRange, { voids: true }) +
      (instant ? text : text.slice(0, -1));

    const isMatch = Array.isArray(prefix)
      ? prefix.includes(prefixText)
      : prefixText === prefix;

    if (!isMatch) {
      insertText(text);
      return;
    }

    editor.withoutNormalizing(() => {
      editor.select(prefixRange);

      if (!Range.isCollapsed(prefixRange)) {
        editor.delete({ at: prefixRange });
      }

      if (transform == null) {
        // Apply default transform
        editor.setNodes({ type: elementType }, { at: blockEntry[1] });
      }

      // Re-select the node since we deleted the prefix text
      const [node] = editor.node(blockEntry[1]);

      const data = {
        prefix: prefixText,
        path: blockEntry[1],
        node,
      };

      transform?.(data);
      afterTransform?.(data);
    });
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

    const match = editor.above({
      match: (n) => Element.isElement(n) && editor.isBlock(n),
    });

    if (match == null || Node.string(match[0]).trim() !== "") {
      deleteBackward(...args);
      return;
    }

    const [block, path] = match;
    const start = editor.start(path);

    const isMatchingBlockType = Array.isArray(fromElementType)
      ? fromElementType.includes(block.type)
      : fromElementType === block.type;

    if (
      !Editor.isEditor(block) &&
      Element.isElement(block) &&
      isMatchingBlockType &&
      Point.equals(selection.anchor, start)
    ) {
      editor.setNodes({ type: toElementType });
      return;
    }

    deleteBackward(...args);
  };

  return editor;
};
