import isHotkey from "is-hotkey";
import { Node, Point, Path, Range } from "slate";
import { withBlockPrefixShortcut } from "../utils.js";

const BULLETED_LIST_ROOT_ELEMENT_TYPE = "bulleted-list";
const NUMBERED_LIST_ROOT_ELEMENT_TYPE = "numbered-list";
const LIST_ITEM_ELEMENT_TYPE = "list-item";

const listRootElementTypes = [
  BULLETED_LIST_ROOT_ELEMENT_TYPE,
  NUMBERED_LIST_ROOT_ELEMENT_TYPE,
];

const isListRoot = (node) => listRootElementTypes.includes(node.type);
const isListItem = (node) => node.type === LIST_ITEM_ELEMENT_TYPE;

const outdentListItem = (editor, [listItemElement, listItemPath]) => {
  const [listElement, listPath] = editor.parent(listItemPath);
  const [parentListElement, parentListPath] =
    editor.above({
      at: listPath,
      match: isListRoot,
    }) ?? [];

  const isNestedList = parentListElement != null;

  if (!isNestedList) {
    editor.withoutNormalizing(() => {
      const listItemPathRef = editor.pathRef(listItemPath);
      editor.liftNodes({ at: listItemPath });
      editor.unwrapNodes({
        at: listItemPathRef.current,
        split: true,
      });
      listItemPathRef.unref();
    });
    return;
  }

  const listItemIndex = listItemPath.slice(-1)[0];
  const listItemCount = listElement.children.length;

  const isLast = listItemIndex === listItemCount - 1;

  if (isLast) {
    editor.withoutNormalizing(() => {
      const pathRef = editor.pathRef(listItemPath);
      editor.liftNodes({ at: pathRef.current });
      editor.liftNodes({ at: pathRef.current });
      pathRef.unref();
    });
    return;
  }

  const itemsBelowRange = {
    anchor: Path.next(listItemPath),
    focus: editor.end(parentListPath),
  };

  editor.withoutNormalizing(() => {
    const pathRef = editor.pathRef(listItemPath);
    editor.wrapNodes(
      { type: parentListElement.type, children: [] },
      {
        at: listPath,
        match: (_, path) =>
          path.length === pathRef.current.length &&
          path.slice(-1)[0] > pathRef.current.slice(-1)[0],
      }
    );
    editor.moveNodes({
      at: itemsBelowRange.anchor,
      to: [...listItemPath, listItemElement.children.length],
    });
    editor.liftNodes({ at: pathRef.current });
    editor.liftNodes({ at: pathRef.current });
    pathRef.unref();
  });
};

const middleware = (editor) => {
  const { deleteBackward, normalizeNode } = editor;

  editor.deleteBackward = (...args) => {
    const { selection } = editor;

    if (!selection || !Range.isCollapsed(selection)) {
      deleteBackward(...args);
      return;
    }

    const matchEntry = editor.above({ match: isListItem });

    const listItemElementPath = matchEntry?.[1];

    if (matchEntry == null) {
      deleteBackward(...args);
      return;
    }

    const selectionIsAtListItemStart = Point.equals(
      selection.anchor,
      editor.start(listItemElementPath)
    );

    if (selectionIsAtListItemStart) {
      outdentListItem(editor, matchEntry);
      return;
    }

    deleteBackward(...args);
  };

  editor.normalizeNode = ([node, path]) => {
    if (node.type === LIST_ITEM_ELEMENT_TYPE) {
      // Unwrap list items that lack a parent list
      const parentNode = Node.parent(editor, path);
      if (parentNode == null || !isListRoot(parentNode)) {
        editor.unwrapNodes({ at: path });
        return;
      }

      for (const [childNode, childPath] of Node.children(editor, path)) {
        if (editor.isInline(childNode)) {
          const text = childNode.text ?? "";
          editor.removeNodes({ at: childPath });
          editor.insertNodes(
            { type: "paragraph", children: [{ text }] },
            { at: childPath }
          );
          return;
        }
      }
    }

    // if (isListRoot(node)) {
    //   // Assert all children are of type "list-item"
    //   for (const [childNode, childNodePath] of Node.children(editor, path)) {
    //     if (childNode.type === "list-item") continue;

    //     if (!isProduction) {
    //       throw new Error(childNodePath);
    //     } else {
    //       editor.liftNodes({ at: childNodePath });
    //       return;
    //     }
    //   }
    // }

    normalizeNode([node, path]);
  };

  return withBlockPrefixShortcut(
    {
      prefix: ["-", "*", "1."],
      transform: ({ path }) => {
        editor.wrapNodes({ type: LIST_ITEM_ELEMENT_TYPE }, { at: path });
      },
      afterTransform: ({ prefix }) => {
        const listType =
          prefix === "1."
            ? NUMBERED_LIST_ROOT_ELEMENT_TYPE
            : BULLETED_LIST_ROOT_ELEMENT_TYPE;
        editor.wrapNodes(
          { type: listType, children: [] },
          { match: isListItem }
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

      if (lineBreakHotkeys.some((h) => isHotkey(h, e))) {
        const parentNonParagraphBlockMatchEntry = editor.above({
          match: (n) => editor.isBlock(n) && n.type !== "paragraph",
        });

        if (
          parentNonParagraphBlockMatchEntry == null ||
          parentNonParagraphBlockMatchEntry[0].type !== LIST_ITEM_ELEMENT_TYPE
        )
          return;

        e.preventDefault();

        const matchEntry = parentNonParagraphBlockMatchEntry;

        const listItemPath = matchEntry[1];
        const isFirstChildBlockEmpty =
          matchEntry[0].children[0].type === "paragraph" &&
          Node.string(matchEntry[0].children[0]).trim() === "";

        // Break out of empty blocks
        if (isFirstChildBlockEmpty) {
          const listMatch = editor.above({ match: isListRoot });
          const parentListMatch = editor.above({
            at: listMatch[1],
            match: isListRoot,
          });

          const isNestedListItem = parentListMatch != null;

          if (isNestedListItem) {
            editor.withoutNormalizing(() => {
              const pathRef = editor.pathRef(listItemPath);
              editor.liftNodes({ at: pathRef.current });
              editor.unwrapNodes({ at: pathRef.current });
              pathRef.unref();
            });
            return;
          }

          outdentListItem(editor, matchEntry);
          return;
        }

        // Split the list item content at the current selection and put into a
        // new list item below
        editor.withoutNormalizing(() => {
          editor.splitNodes({ always: true });
          editor.select({
            anchor: editor.selection.anchor,
            focus: editor.end(listItemPath),
          });
          editor.wrapNodes({ type: LIST_ITEM_ELEMENT_TYPE, children: [] });
          editor.liftNodes({
            match: (_, path) => path.length === listItemPath.length + 1,
          });
          editor.collapse();
        });

        return;
      }

      if (isHotkey("tab", e)) {
        const matchEntry = editor.above({ match: isListItem });

        if (matchEntry == null) return;

        e.preventDefault();

        const listItemPath = matchEntry[1];
        const listItemIndex = listItemPath.slice(-1)[0];

        if (listItemIndex === 0) return;

        const listType = Node.parent(editor, listItemPath).type;

        const previousListItemPath = Path.previous(listItemPath);

        const maybePreviousNestedListPath = [
          ...previousListItemPath,
          Node.get(editor, previousListItemPath).children.length - 1,
        ];
        const maybePreviousNestedListNode = Node.get(
          editor,
          maybePreviousNestedListPath
        );

        if (isListRoot(maybePreviousNestedListNode)) {
          const targetPath = [
            ...maybePreviousNestedListPath,
            maybePreviousNestedListNode.children.length,
          ];
          editor.moveNodes({ at: listItemPath, to: targetPath });
          return;
        }

        editor.withoutNormalizing(() => {
          editor.wrapNodes(
            { type: listType, children: [] },
            { at: listItemPath }
          );
          editor.moveNodes({
            at: listItemPath,
            to: Path.next(maybePreviousNestedListPath),
          });
        });

        return;
      }

      if (isHotkey("Shift+tab", e)) {
        const listItemMatchEntry = editor.above({ match: isListItem });
        if (listItemMatchEntry == null) return;
        e.preventDefault();
        outdentListItem(editor, listItemMatchEntry);
        return;
      }
    },
  },
});
