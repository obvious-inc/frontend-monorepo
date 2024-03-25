import isHotkey from "is-hotkey";
import { Range, Node } from "slate";
import { function as functionUtils } from "@shades/common/utils";
import {
  withBlockPrefixShortcut,
  withEmptyBlockBackwardDeleteTransform,
  intersectsSelection,
} from "../utils.js";

const { compose } = functionUtils;

const CALLOUT_ELEMENT_TYPE = "callout";

const middleware = (editor) => {
  const { normalizeNode, deleteBackward } = editor;

  editor.normalizeNode = ([node, path]) => {
    if (
      node.type !== CALLOUT_ELEMENT_TYPE ||
      intersectsSelection(editor, path)
    ) {
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
      const nodeStartPoint = editor.start(path);
      editor.delete({
        at: {
          anchor: nodeStartPoint,
          focus: editor.after(nodeStartPoint),
        },
      });
      return;
    }

    const endMatch = nodeString.match(/\s+$/)?.[0];

    // Trim end edge line breaks
    if (endMatch?.includes("\n")) {
      const nodeEndPoint = editor.end(path);
      editor.delete({
        at: {
          anchor: nodeEndPoint,
          focus: editor.before(nodeEndPoint),
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

    const matchEntry = editor.above({
      match: (n) => n.type === CALLOUT_ELEMENT_TYPE,
    });

    if (matchEntry == null) {
      deleteBackward(...args);
      return;
    }

    const characterBeforeCursor = editor.string({
      anchor: editor.before(selection.anchor),
      focus: selection.focus,
    });
    const textAfterCursor = editor.string({
      anchor: selection.anchor,
      focus: editor.end(matchEntry[1]),
    });

    if (characterBeforeCursor !== "\n" || textAfterCursor.trim() !== "") {
      deleteBackward(...args);
      return;
    }

    deleteBackward(...args);
    editor.insertBreak();
    editor.setNodes({ type: "paragraph" });
  };

  return compose(
    (e) =>
      withBlockPrefixShortcut(
        { prefix: ">>", elementType: CALLOUT_ELEMENT_TYPE },
        e,
      ),
    (e) =>
      withEmptyBlockBackwardDeleteTransform(
        { fromElementType: CALLOUT_ELEMENT_TYPE, toElementType: "paragraph" },
        e,
      ),
  )(editor);
};

export default ({ mode } = {}) => ({
  middleware,
  handlers: {
    onKeyDown: (e, editor) => {
      if (e.isDefaultPrevented()) return;

      const lineBreakHotkeys =
        mode === "inline" ? ["shift+enter"] : ["shift+enter", "enter"];

      if (!lineBreakHotkeys.some((h) => isHotkey(h, e))) return;

      const matchEntry = editor.above({
        match: (node) => node.type === CALLOUT_ELEMENT_TYPE,
      });

      if (matchEntry == null) return;

      e.preventDefault();
      editor.insertText("\n");
    },
  },
});
