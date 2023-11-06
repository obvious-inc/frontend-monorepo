import isHotkey from "is-hotkey";
import { Editor, Range, Transforms } from "slate";
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

    const matchEntry = Editor.above(editor, {
      match: (n) => n.type === ELEMENT_TYPE,
    });

    if (matchEntry == null) {
      deleteBackward(...args);
      return;
    }

    const characterBeforeCursor = Editor.string(editor, {
      anchor: editor.before(selection.anchor),
      focus: selection.focus,
    });
    const textAfterCursor = Editor.string(editor, {
      anchor: selection.anchor,
      focus: editor.end(matchEntry[1]),
    });

    if (characterBeforeCursor === "\n" && textAfterCursor.trim() === "") {
      deleteBackward(...args);
      editor.insertBreak();
      editor.setNodes({ type: "paragraph" });
      return;
    }

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
      const lineBreakHotkeys = ["shift+enter", "enter"];

      if (lineBreakHotkeys.some((h) => isHotkey(h, e))) {
        const matchEntry = Editor.above(editor, {
          match: (node) => node.type === ELEMENT_TYPE,
        });

        if (matchEntry != null) {
          e.preventDefault();
          editor.insertText("\n");
        }
      }

      if (isHotkey("mod+a", e)) {
        const matchEntry = Editor.above(editor, {
          match: (node) => node.type === ELEMENT_TYPE,
        });

        if (matchEntry != null) {
          e.preventDefault();
          Transforms.select(editor, matchEntry[1]);
        }
      }
    },
  },
});
