import { Node, Path } from "slate";
import { useSelected, useFocused } from "slate-react";
import { function as functionUtils } from "@shades/common/utils";
import { withBlockPrefixShortcut } from "../utils.js";

const { compose } = functionUtils;

const DIVIDER_ELEMENT_TYPE = "horizontal-divider";

const middleware = (editor) => {
  const { isVoid } = editor;

  editor.isVoid = (element) =>
    element.type === DIVIDER_ELEMENT_TYPE || isVoid(element);

  return compose((editor) =>
    withBlockPrefixShortcut(
      {
        prefix: "---",
        elementType: DIVIDER_ELEMENT_TYPE,
        transform: ({ node, path }) => {
          const childText = Node.string(node);

          // If the node is empty we can simply change the node type
          if (childText.trim() === "") {
            editor.setNodes({ type: DIVIDER_ELEMENT_TYPE }, { at: path });
            return;
          }

          // If we have text content we can let the paragraph be and insert the
          // divider above it
          editor.insertNodes(
            { type: DIVIDER_ELEMENT_TYPE, children: [{ text: "" }] },
            { at: path },
          );
        },
        afterTransform: () => {
          const selectedBlockNodePath = editor.above({
            match: (n) => editor.isBlock(n),
          })?.[1];

          const nextSelectableBlockNodePath = editor.next({
            at: selectedBlockNodePath,
            match: (node) => !editor.isVoid(node),
          })?.[1];

          // If the next sibling isn’t selectable, we insert an empty paragraph
          // below the divider to have somewhere to place the editor selection
          if (nextSelectableBlockNodePath == null) {
            const at = Path.next(selectedBlockNodePath);
            editor.insertNodes(
              { type: "paragraph", children: [{ text: "" }] },
              { at },
            );
            editor.select(editor.start(at));
            return;
          }

          const selectableStartPoint = editor.start(
            nextSelectableBlockNodePath,
          );
          editor.select(selectableStartPoint);
        },
      },
      editor,
    ),
  )(editor);
};

const Component = ({ attributes, children }) => {
  const selected = useSelected();
  const focused = useFocused();
  const isFocused = selected && focused;

  return (
    <div
      {...attributes}
      role="separator"
      contentEditable={false}
      data-focused={isFocused ? "true" : undefined}
    >
      {children}
    </div>
  );
};

export default () => ({
  middleware,
  elements: { [DIVIDER_ELEMENT_TYPE]: Component },
});
