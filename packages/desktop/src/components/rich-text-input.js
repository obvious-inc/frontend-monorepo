import React from "react";
import { css } from "@emotion/react";
import { createEditor as createSlateEditor, Transforms, Editor } from "slate";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { withHistory } from "slate-history";
import isHotkey from "is-hotkey";
import { functionUtils } from "@shades/common";
import { createCss as createRichTextCss } from "./rich-text";
import createControlledParagraphLineBreaksPlugin from "../slate/plugins/controlled-paragraph-line-breaks";
import createInlineLinksPlugin from "../slate/plugins/inline-links";
import { mergePlugins } from "../slate/utils";

const { compose } = functionUtils;

const markHotkeys = {
  "mod+b": "bold",
  "mod+i": "italic",
  "mod+shift+x": "strikethrough",
};

const withMarks = (editor) => {
  const isMarkActive = (format) => {
    const marks = Editor.marks(editor);
    return marks ? marks[format] === true : false;
  };

  editor.toggleMark = (format) => {
    const isActive = isMarkActive(format);

    if (isActive) {
      Editor.removeMark(editor, format);
      return;
    }

    Editor.addMark(editor, format, true);
  };

  return editor;
};

const withFocus = (editor) => {
  editor.focus = () => ReactEditor.focus(editor);
  return editor;
};

const withClear = (editor) => {
  editor.clear = () => {
    editor.children = [{ type: "paragraph", children: [{ text: "" }] }];
    // Move cursor to start
    Transforms.select(editor, Editor.start(editor, []));
  };
  return editor;
};

const RichTextInput = React.forwardRef(
  ({ value, onChange, onKeyDown, ...props }, ref) => {
    const { editor, handlers, customElementsByNodeType } = React.useMemo(() => {
      const editor = compose(
        withMarks,
        withFocus,
        withClear,
        withReact,
        withHistory
      )(createSlateEditor());

      const { middleware, elements, handlers } = mergePlugins([
        createControlledParagraphLineBreaksPlugin(),
        createInlineLinksPlugin(),
      ]);

      return {
        editor: middleware(editor),
        customElementsByNodeType: elements,
        handlers,
      };
    }, []);

    const renderElement = React.useCallback(
      (props) => {
        const CustomComponent = customElementsByNodeType[props.element.type];
        if (CustomComponent) return <CustomComponent {...props} />;
        return <Element {...props} />;
      },
      [customElementsByNodeType]
    );
    const renderLeaf = React.useCallback((props) => <Leaf {...props} />, []);

    React.useEffect(() => {
      ref.current = editor;
    }, [ref, editor, onChange]);

    return (
      <Slate
        editor={editor}
        value={value}
        onChange={(value) => {
          handlers.onChange(value, editor);
          onChange(value);
        }}
      >
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          onKeyDown={(e) => {
            handlers.onKeyDown(e, editor);

            for (const hotkey in markHotkeys) {
              if (isHotkey(hotkey, e)) {
                e.preventDefault();
                const mark = markHotkeys[hotkey];
                editor.toggleMark(mark);
              }
            }

            if (onKeyDown) onKeyDown(e);
          }}
          css={(theme) => {
            const styles = createRichTextCss(theme);
            return css({ ...styles, "a:hover": { textDecoration: "none" } });
          }}
          {...props}
        />
      </Slate>
    );
  }
);

const Element = ({ ...props }) => {
  const { attributes, children, element } = props;

  switch (element.type) {
    case "paragraph":
      return <p {...attributes}>{children}</p>;
    default:
      throw new Error(`Unrecognized element type "${element.type}"`);
  }
};

const Leaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) children = <strong>{children}</strong>;
  if (leaf.italic) children = <em>{children}</em>;
  if (leaf.strikethrough) children = <s>{children}</s>;

  return <span {...attributes}>{children}</span>;
};

export default RichTextInput;
