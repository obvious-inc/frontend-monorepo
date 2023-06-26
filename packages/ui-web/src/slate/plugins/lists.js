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

    Editor.withoutNormalizing(editor, () => {
      Transforms.setNodes(editor, { type: "paragraph" });
      Transforms.unwrapNodes(editor, {
        at: matchingNodePath,
        match: (n) => listNodeTypes.includes(n.type),
        split: true,
      });
    });
  };

  editor.normalizeNode = ([node, path]) => {
    if (node.type === "list-item") {
      // Unwrap list items that lack a parent list
      const parentNode = Node.parent(editor, path);
      if (parentNode == null || !listNodeTypes.includes(parentNode.type)) {
        Transforms.unwrapNodes(editor, { at: path });
        return;
      }

      // Remove nested block elements
      for (const [childNode, childPath] of Node.children(editor, path)) {
        if (childNode.text == null && !editor.isInline(childNode)) {
          Transforms.unwrapNodes(editor, { at: childPath });
          return;
        }
      }
    }

    if (listNodeTypes.includes(node.type)) {
      // Assert all children are of type "list-item"
      for (const [childNode, childNodePath] of Node.children(editor, path)) {
        if (childNode.type === "list-item") continue;
        Transforms.wrapNodes(
          editor,
          { type: "list-item", children: [] },
          { at: childNodePath }
        );
        return;
      }
    }

    normalizeNode([node, path]);
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

      const isEmpty = node.children.every(
        (n) => n.text != null && n.text.trim() === ""
      );

      // Only break out of non-empty list items
      if (!isEmpty) return;

      Editor.withoutNormalizing(editor, () => {
        Transforms.setNodes(editor, { type: "paragraph", at: path });
        Transforms.unwrapNodes(editor, {
          at: path,
          match: (n) => listNodeTypes.includes(n.type),
          split: true,
        });
      });

      e.preventDefault();
      // editor.insertText("\n");
    },
  },
});
