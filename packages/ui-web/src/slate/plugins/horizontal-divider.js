import isHotkey from "is-hotkey";
import { Editor, Node, Transforms } from "slate";
import { function as functionUtils } from "@shades/common/utils";
import {
  withBlockPrefixShortcut,
  withEmptyBlockBackwardDeleteTransform,
} from "../utils.js";

const { compose } = functionUtils;

const ELEMENT_TYPE = "horizontal-divider";

const findAbove = (editor, at = editor.selection) =>
  Editor.above(editor, {
    at,
    match: (n) => n.type === ELEMENT_TYPE,
  });

const middleware = (editor) => {
  const { isVoid, normalizeNode } = editor;

  editor.isVoid = (element) => {
    return element.type === ELEMENT_TYPE || isVoid(element);
  };

  editor.normalizeNode = ([node, path]) => {
    if (node.type !== ELEMENT_TYPE) {
      normalizeNode([node, path]);
      return;
    }

    const nodeString = Node.string(node);

    // If the node is not empty, move text to new paragraph and insert divider above
    if (nodeString.trim() !== "") {
      const nodeStartPoint = Editor.start(editor, path);

      Transforms.delete(editor, {
        at: {
          anchor: nodeStartPoint,
          focus:
            Editor.after(editor, nodeStartPoint) || Editor.end(editor, path),
        },
      });

      Transforms.insertNodes(editor, {
        type: ELEMENT_TYPE,
        children: [{ text: "" }],
      });

      Transforms.insertNodes(editor, {
        type: "paragraph",
        children: [{ text: nodeString }],
      });

      Transforms.select(editor, Editor.start(editor, path));

      return;
    }
  };

  return compose(
    (e) =>
      withBlockPrefixShortcut({ prefix: "---", elementType: ELEMENT_TYPE }, e),
    (e) =>
      withEmptyBlockBackwardDeleteTransform(
        { fromElementType: ELEMENT_TYPE, toElementType: "paragraph" },
        e
      )
  )(editor);
};

const onChange = (_, editor) => {
  if (findAbove(editor)) {
    Transforms.move(editor, { unit: "offset", distance: 1 });
  }
};

const onKeyDown = (e, editor) => {
  if (!isHotkey("enter", e)) return;

  const matchEntry = Editor.above(editor, {
    match: (node) => node.type === ELEMENT_TYPE,
  });

  if (matchEntry == null) return;

  e.preventDefault();
  editor.insertNodes({ type: "paragraph", children: [{ text: "" }] });
};

export default () => ({
  middleware,
  handlers: { onChange, onKeyDown },
});
