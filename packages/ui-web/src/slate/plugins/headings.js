import isHotkey from "is-hotkey";
import {
  Transforms,
  Editor,
  // Range,
  // Point,
  // Element as SlateElement,
} from "slate";
import { function as functionUtils } from "@shades/common/utils";
import {
  withBlockPrefixShortcut,
  withEmptyBlockBackwardDeleteTransform,
} from "../utils.js";

const elementTypes = ["heading-1", "heading-2"];

const { compose } = functionUtils;

// TODO: prevent line breaks
const middleware = (editor) => {
  return compose(
    (e) =>
      withBlockPrefixShortcut({ prefix: "#", elementType: "heading-1" }, e),
    (e) =>
      withBlockPrefixShortcut({ prefix: "##", elementType: "heading-2" }, e),
    (e) =>
      withEmptyBlockBackwardDeleteTransform(
        { fromElementType: elementTypes, toElementType: "paragraph" },
        e
      )
  )(editor);
};

export default ({ inline = false } = {}) => ({
  middleware,
  handlers: {
    onKeyDown: (e, editor) => {
      const linebreakHotkeys = inline
        ? ["shift+enter"]
        : ["shift+enter", "enter"];

      if (!linebreakHotkeys.some((h) => isHotkey(h, e))) return;

      const matchEntry = Editor.above(editor, {
        match: (node) => elementTypes.includes(node.type),
      });

      if (matchEntry == null) return;

      e.preventDefault();
      Editor.insertBreak(editor);
      Transforms.setNodes(editor, { type: "paragraph" });
    },
  },
});
