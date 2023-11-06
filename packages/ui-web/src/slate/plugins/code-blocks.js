import isHotkey from "is-hotkey";
import { Point, Range } from "slate";
import { function as functionUtils } from "@shades/common/utils";
import {
  withBlockPrefixShortcut,
  withEmptyBlockBackwardDeleteTransform,
} from "../utils.js";

const { compose } = functionUtils;

const ELEMENT_TYPE = "code-block";

const middleware = (editor) => {
  const { deleteBackward, isLeafBlock } = editor;

  editor.isLeafBlock = (node) =>
    node.type === ELEMENT_TYPE || isLeafBlock(node);

  editor.deleteBackward = (...args) => {
    const { selection } = editor;

    if (!selection || !Range.isCollapsed(selection)) {
      deleteBackward(...args);
      return;
    }

    const matchEntry = editor.above({
      match: (n) => n.type === ELEMENT_TYPE,
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

    if (characterBeforeCursor === "\n" && textAfterCursor.trim() === "") {
      deleteBackward(...args);
      editor.insertBreak();
      editor.setNodes({ type: "paragraph" });
      return;
    }

    const blockStartPoint = editor.start(matchEntry[1]);

    if (Point.equals(selection.anchor, blockStartPoint)) return;

    deleteBackward(...args);
  };

  return compose(
    (e) =>
      withBlockPrefixShortcut(
        { prefix: "```", instant: true, elementType: ELEMENT_TYPE },
        e
      ),
    (e) =>
      withEmptyBlockBackwardDeleteTransform(
        { fromElementType: ELEMENT_TYPE, toElementType: "paragraph" },
        e
      )
  )(editor);
};

export default () => ({
  middleware,
  handlers: {
    onKeyDown: (e, editor) => {
      if (e.isDefaultPrevented()) return;

      const lineBreakHotkeys = ["shift+enter", "enter"];

      if (lineBreakHotkeys.some((h) => isHotkey(h, e))) {
        const matchEntry = editor.above({
          match: (node) => node.type === ELEMENT_TYPE,
        });

        if (matchEntry != null) {
          e.preventDefault();
          editor.insertText("\n");
        }
      }

      if (isHotkey("mod+a", e)) {
        const matchEntry = editor.above({
          match: (node) => node.type === ELEMENT_TYPE,
        });

        if (matchEntry != null) {
          e.preventDefault();
          editor.select(matchEntry[1]);
        }
      }
    },
  },
});
