import isHotkey from "is-hotkey";
import { Editor, Node, Transforms } from "slate";
import { search } from "../utils";

const middleware = (editor) => {
  const { normalizeNode } = editor;

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
