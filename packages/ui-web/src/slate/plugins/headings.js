import isHotkey from "is-hotkey";
import {
  Transforms,
  Editor,
  Node,
  // Range,
  // Point,
  // Element as SlateElement,
} from "slate";
import { function as functionUtils } from "@shades/common/utils";
import {
  withBlockPrefixShortcut,
  withEmptyBlockBackwardDeleteTransform,
} from "../utils.js";

const elementTypes = ["heading-1", "heading-2", "heading-3"];

const { compose } = functionUtils;

const middleware = (editor) => {
  const { normalizeNode } = editor;

  editor.normalizeNode = ([node, path]) => {
    if (!elementTypes.includes(node.type)) {
      normalizeNode([node, path]);
      return;
    }

    for (const [childNode, childPath] of Node.children(editor, path)) {
      // Element children aren’t allowed
      if (childNode.children != null) {
        Transforms.unwrapNodes(editor, { at: childPath });
        return;
      }

      // We only allow a single child
      const childLeafIndex = childPath.slice(-1)[0];
      if (childLeafIndex !== 0) {
        Transforms.mergeNodes(editor, { at: childPath });
        return;
      }

      // No line breaks
      if (childNode.text.includes("\n")) {
        Transforms.insertText(editor, childNode.text.split("\n").join(" "), {
          at: childPath,
        });
        return;
      }

      // No marks
      if (childNode.italic || childNode.bold || childNode.strikethrough) {
        Transforms.unsetNodes(editor, ["italic", "bold", "strikethrough"], {
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
