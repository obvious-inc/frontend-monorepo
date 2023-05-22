import isHotkey from "is-hotkey";
import { Editor, Node, Transforms } from "slate";
import { search, intersectsSelection } from "../utils";

const PARAGRAPH_ELEMENT_TYPE = "paragraph";

const middleware = (editor) => {
  const { normalizeNode } = editor;

  editor.normalizeNode = ([node, path]) => {
    if (node.type !== PARAGRAPH_ELEMENT_TYPE) {
      normalizeNode([node, path]);
      return;
    }

    const nodeString = Node.string(node);
    const hasSelection = intersectsSelection(editor, path);

    // Remove empty paragraphs
    if (
      nodeString.trim() === "" &&
      !hasSelection && // Empty nodes are allowed whereever the cursor is
      editor.children.length > 1 // If it’s the last remaining node, we let it be
    ) {
      Transforms.removeNodes(editor, { at: path });
      return;
    }

    const startMatch = nodeString.match(/^\s+/)?.[0];

    // Prevent leading line breaks
    if (startMatch?.includes("\n")) {
      const nodeStart = Editor.start(editor, path);

      Transforms.delete(editor, {
        at: { anchor: nodeStart, focus: Editor.after(editor, nodeStart) },
      });
      return;
    }

    const endMatch = nodeString.match(/\s+$/)?.[0];

    // Prevent trailing line breaks
    if (
      endMatch?.includes("\n") &&
      !hasSelection // A trailing line break is fine if the cursor it there
    ) {
      const nodeEnd = Editor.end(editor, path);

      Transforms.delete(editor, {
        at: { anchor: nodeEnd, focus: Editor.before(editor, nodeEnd) },
      });
      return;
    }

    // Find occurances of 2 consecutive line breaks
    const match = nodeString
      .match(/\s+/g)
      ?.find((m) => m.split("\n").length > 2);

    if (!match) {
      normalizeNode([node, path]);
      return;
    }

    // Split the paragraph wherever there’s a match
    const [start, end] = Editor.edges(editor, path);
    const [matchStartPoint] = search(editor, match, {
      at: { anchor: start, focus: end },
    });

    Transforms.splitNodes(editor, { at: matchStartPoint });
  };

  return editor;
};

export default () => ({
  middleware,
  handlers: {
    onKeyDown: (e, editor) => {
      if (!isHotkey("shift+enter", e)) return;

      const matchEntry = Editor.above(editor, {
        match: (node) => node.type === PARAGRAPH_ELEMENT_TYPE,
      });

      if (matchEntry == null) return;

      e.preventDefault();
      editor.insertText("\n");
    },
  },
});
