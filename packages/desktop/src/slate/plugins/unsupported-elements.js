
import { Transforms } from "slate";
import { useSelected, useFocused } from "slate-react";


const middleware = (editor) => {
  const { isInline, isVoid } = editor;

  editor.isInline = (element) => {
    return element.type === "user" ? true : isInline(element);
  };

  editor.isVoid = (element) => {
    return element.type === "user" ? true : isVoid(element);
  };

  editor.insertMention = (ref, { at } = {}) => {
    const mention = {
      type: "user",
      ref,
      children: [{ text: "" }],
    };
    if (at) Transforms.select(editor, at);
    Transforms.insertNodes(editor, mention);
    Transforms.move(editor);
    editor.insertText(" ");
  };

  return editor;
};

const MentionComponent = ({ id, displayName, attributes, children }) => {
  const selected = useSelected();
  const focused = useFocused();
  const isFocused = selected && focused;
  return (
    <span
      className="mention"
      data-focused={isFocused ? "true" : undefined}
      {...attributes}
    >
      @{displayName ?? id}
      {children}
    </span>
  );
};

export default () => ({
  middleware: createMiddleware({}),
  elements: { user: MentionComponent },
});
