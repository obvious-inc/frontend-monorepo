import isHotkey from "is-hotkey";
import { Editor, Node, Path, Transforms, Text } from "slate";

const middleware = (editor) => {
  const { normalizeNode } = editor;

  const search = (editor, query, { at = editor.selection } = {}) => {
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

  editor.normalizeNode = ([node, path]) => {
    if (node.type !== "paragraph") {
      normalizeNode([node, path]);
      return;
    }

    const nodeString = Node.string(node);

    const startMatch = nodeString.match(/^\s+/)?.[0];

    if (startMatch?.includes("\n")) {
      const [start, end] = Editor.edges(editor, path);
      const nodeRange = Editor.range(editor, start, end);
      const matchEdgePoints = search(editor, startMatch, {
        at: nodeRange,
      });
      Transforms.delete(editor, {
        at: Editor.range(editor, ...matchEdgePoints),
      });
      return;
    }

    const match = nodeString
      .match(/\s+/g)
      ?.find((m) => m.split("\n").length > 2);

    if (match) {
      const [start, end] = Editor.edges(editor, path);
      const nodeRange = Editor.range(editor, start, end);
      const [matchStartPoint] = search(editor, match, {
        at: nodeRange,
      });

      Transforms.splitNodes(editor, { at: matchStartPoint });
      return;
    }

    normalizeNode([node, path]);
  };

  return editor;
};

const onKeyDown = (e, editor) => {
  const matchEntry = Editor.above(editor, {
    match: (node) => node.type === "paragraph",
  });

  if (matchEntry && isHotkey("shift+enter", e)) {
    e.preventDefault();
    editor.insertText("\n");
  }
};

export default () => ({
  middleware,
  handlers: {
    onKeyDown,
  },
});
