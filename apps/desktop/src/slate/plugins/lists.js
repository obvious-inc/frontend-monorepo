import isHotkey from "is-hotkey";
import { Editor, Node, Range, Point, Transforms } from "slate";
import { withBlockPrefixShortcut } from "../utils.js";

const listNodeTypes = ["bulleted-list", "numbered-list"];

const middleware = (editor) => {
  const { deleteBackward, normalizeNode } = editor;

  editor.deleteBackward = (...args) => {
    const { selection } = editor;

    if (!selection || !Range.isCollapsed(selection)) {
      deleteBackward(...args);
      return;
    }

    const matchEntry = Editor.above(editor, {
      match: (n) => n.type === "list-item",
    });

    const matchingNodePath = matchEntry?.[1];

    if (
      matchEntry == null ||
      !Point.equals(selection.anchor, Editor.start(editor, matchingNodePath))
    ) {
      deleteBackward(...args);
      return;
    }

    Transforms.unwrapNodes(editor, {
      at: matchingNodePath,
      match: (n) => listNodeTypes.includes(n.type),
      split: true,
    });
    Transforms.setNodes(editor, { type: "paragraph" });
  };

  editor.normalizeNode = ([node, path]) => {
    if (node.type == null || !listNodeTypes.includes(node.type)) {
      normalizeNode([node, path]);
      return;
    }

    // Assert all children are of type "list-item"
    for (const [childNode, childNodePath] of Node.children(editor, path)) {
      if (childNode.type === "list-item") continue;
      Transforms.setNodes(editor, { type: "list-item" }, { at: childNodePath });
    }
  };

  return withBlockPrefixShortcut(
    {
      prefix: ["-", "*", "1."],
      elementType: "list-item",
      afterTransform: ({ prefix }) => {
        const listType = prefix === "1." ? "numbered-list" : "bulleted-list";
        Transforms.wrapNodes(
          editor,
          { type: listType, children: [] },
          { match: (n) => n.type === "list-item" }
        );
      },
    },
    editor
  );
};

export default ({ inline = false } = {}) => ({
  middleware,
  handlers: {
    onKeyDown: (e, editor) => {
      const lineBreakHotkeys = inline
        ? ["shift+enter"]
        : ["shift+enter", "enter"];

      if (!lineBreakHotkeys.some((h) => isHotkey(h, e))) return;

      const matchEntry = Editor.above(editor, {
        match: (node) => node.type === "list-item",
      });

      if (matchEntry == null) return;

      const [node, path] = matchEntry;

      // Non-empty list item
      if (node.children.length !== 1 || node.children[0].text.trim() !== "")
        return;

      Transforms.unwrapNodes(editor, {
        at: path,
        match: (n) => listNodeTypes.includes(n.type),
        split: true,
      });
      Transforms.setNodes(editor, { type: "paragraph" });

      e.preventDefault();
      // editor.insertText("\n");
    },
  },
});
