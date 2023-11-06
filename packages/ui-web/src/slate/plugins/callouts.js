import isHotkey from "is-hotkey";
import { Editor, Range, Node, Transforms } from "slate";
import { function as functionUtils } from "@shades/common/utils";
import {
  withBlockPrefixShortcut,
  withEmptyBlockBackwardDeleteTransform,
  intersectsSelection,
} from "../utils.js";

const { compose } = functionUtils;

const ELEMENT_TYPE = "callout";

const middleware = (editor) => {
  const { normalizeNode, deleteBackward } = editor;

  editor.normalizeNode = ([node, path]) => {
    if (node.type !== ELEMENT_TYPE || intersectsSelection(editor, path)) {
      normalizeNode([node, path]);
      return;
    }

    const nodeString = Node.string(node);

    // if (nodeString.trim() === "") {
    //   Transforms.removeNodes(editor, { at: path });
    //   return;
    // }

    // Trim start edge line breaks
    const startMatch = nodeString.match(/^\s+/)?.[0];

    if (startMatch?.includes("\n")) {
      const nodeStartPoint = Editor.start(editor, path);
      Transforms.delete(editor, {
        at: {
          anchor: nodeStartPoint,
          focus: Editor.after(editor, nodeStartPoint),
        },
      });
      return;
    }

    const endMatch = nodeString.match(/\s+$/)?.[0];

    // Trim end edge line breaks
    if (endMatch?.includes("\n")) {
      const nodeEndPoint = Editor.end(editor, path);
      Transforms.delete(editor, {
        at: {
          anchor: nodeEndPoint,
          focus: Editor.before(editor, nodeEndPoint),
        },
      });
    }
  };

  editor.deleteBackward = (...args) => {
    const { selection } = editor;

    if (!selection || !Range.isCollapsed(selection)) {
      deleteBackward(...args);
      return;
    }

    const matchEntry = Editor.above(editor, {
      match: (n) => n.type === ELEMENT_TYPE,
    });

    if (matchEntry == null) {
      deleteBackward(...args);
      return;
    }

    const characterBeforeCursor = Editor.string(editor, {
      anchor: Editor.before(editor, selection.anchor),
      focus: selection.focus,
    });
    const textAfterCursor = Editor.string(editor, {
      anchor: selection.anchor,
      focus: Editor.end(editor, matchEntry[1]),
    });

    if (characterBeforeCursor !== "\n" || textAfterCursor.trim() !== "") {
      deleteBackward(...args);
      return;
    }

    deleteBackward(...args);
    Editor.insertBreak(editor);
    Transforms.setNodes(editor, { type: "paragraph" });
  };

  return compose(
    (e) =>
      withBlockPrefixShortcut({ prefix: ">>", elementType: ELEMENT_TYPE }, e),
    (e) =>
      withEmptyBlockBackwardDeleteTransform(
        { fromElementType: ELEMENT_TYPE, toElementType: "paragraph" },
        e
      )
  )(editor);
};

export default ({ inline = false } = {}) => ({
  middleware,
  handlers: {
    onKeyDown: (e, editor) => {
      if (e.isDefaultPrevented()) return;

      const lineBreakHotkeys = inline
        ? ["shift+enter"]
        : ["shift+enter", "enter"];

      if (!lineBreakHotkeys.some((h) => isHotkey(h, e))) return;

      const matchEntry = Editor.above(editor, {
        match: (node) => node.type === ELEMENT_TYPE,
      });

      if (matchEntry == null) return;

      e.preventDefault();
      editor.insertText("\n");
    },
  },
});
