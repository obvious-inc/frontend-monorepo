import { Editor, Node, Path, Range } from "slate";

// https://github.com/ianstormtaylor/slate/issues/3991
const middleware = (editor) => {
  const { deleteBackward, insertBreak } = editor;

  // if current selection is a void node, insert a default node below
  editor.insertBreak = () => {
    if (editor.selection == null || !Range.isCollapsed(editor.selection)) {
      insertBreak();
      return;
    }

    const selectedNodePath = Path.parent(editor.selection.anchor.path);
    const selectedNode = Node.get(editor, selectedNodePath);

    if (Editor.isVoid(editor, selectedNode)) {
      editor.insertNode({
        type: "paragraph",
        children: [{ text: "" }],
      });
      return;
    }

    insertBreak();
  };

  // if prev node is a void node, remove the current node if it's empty and select the void node
  editor.deleteBackward = (unit) => {
    if (
      !editor.selection ||
      !Range.isCollapsed(editor.selection) ||
      editor.selection.anchor.offset !== 0
    ) {
      deleteBackward(unit);
      return;
    }

    const parentPath = Path.parent(editor.selection.anchor.path);

    if (!Path.hasPrevious(parentPath)) {
      deleteBackward(unit);
      return;
    }

    const parentNode = Node.get(editor, parentPath);
    const parentIsEmpty = Node.string(parentNode).length === 0;

    if (parentIsEmpty) {
      const prevNode = Node.get(editor, Path.previous(parentPath));
      if (Editor.isVoid(editor, prevNode)) {
        editor.removeNodes();
        return;
      }
    }

    deleteBackward(unit);
  };

  return editor;
};

export default () => ({ middleware });
