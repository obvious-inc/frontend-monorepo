import isHotkey from "is-hotkey";
import { Node } from "slate";
import { function as functionUtils } from "@shades/common/utils";
import {
  withBlockPrefixShortcut,
  withEmptyBlockBackwardDeleteTransform,
} from "../utils.js";

const elementTypes = [
  "heading-1",
  "heading-2",
  "heading-3",
  "heading-4",
  "heading-5",
  "heading-6",
];

const { compose } = functionUtils;

const middleware = (editor) => {
  const { normalizeNode, isLeafBlock } = editor;

  editor.isLeafBlock = (node) =>
    elementTypes.includes(node.type) || isLeafBlock(node);

  editor.normalizeNode = ([node, path]) => {
    if (!elementTypes.includes(node.type)) {
      normalizeNode([node, path]);
      return;
    }

    for (const [childNode, childPath] of Node.children(editor, path)) {
      // Element children aren’t allowed
      if (childNode.children != null) {
        if (editor.isBlock(childNode)) {
          editor.liftNodes({ at: childPath });
          return;
        }

        editor.unwrapNodes({ at: childPath });
        return;
      }

      // We only allow a single child
      const childLeafIndex = childPath.slice(-1)[0];
      if (childLeafIndex !== 0) {
        editor.mergeNodes({ at: childPath });
        return;
      }

      // No line breaks
      if (childNode.text.includes("\n")) {
        const flatText = childNode.text.split("\n").join(" ");
        editor.withoutNormalizing(() => {
          // A regular `editor.insertText()` refuses to work, don’t know why
          editor.delete({ at: editor.range(childPath) });
          editor.apply({
            type: "insert_text",
            path: childPath,
            offset: 0,
            text: flatText,
          });
        });
        return;
      }

      // No marks
      if (childNode.italic || childNode.bold || childNode.strikethrough) {
        editor.unsetNodes(["italic", "bold", "strikethrough"], {
          at: childPath,
        });
        return;
      }
    }

    normalizeNode([node, path]);
    return;
  };

  return compose(
    (e) =>
      withBlockPrefixShortcut({ prefix: "#", elementType: "heading-1" }, e),
    (e) =>
      withBlockPrefixShortcut({ prefix: "##", elementType: "heading-2" }, e),
    (e) =>
      withBlockPrefixShortcut({ prefix: "###", elementType: "heading-3" }, e),
    (e) =>
      withEmptyBlockBackwardDeleteTransform(
        { fromElementType: elementTypes, toElementType: "paragraph" },
        e,
      ),
  )(editor);
};

export default ({ mode } = {}) => ({
  middleware,
  handlers: {
    onKeyDown: (e, editor) => {
      if (e.isDefaultPrevented()) return;

      const linebreakHotkeys =
        mode === "inline" ? ["shift+enter"] : ["shift+enter", "enter"];

      if (!linebreakHotkeys.some((h) => isHotkey(h, e))) return;

      const matchEntry = editor.above({
        match: (node) => elementTypes.includes(node.type),
      });

      if (matchEntry == null) return;

      e.preventDefault();

      editor.withoutNormalizing(() => {
        editor.insertBreak();
        editor.setNodes({ type: "paragraph" });
      });
    },
  },
});
