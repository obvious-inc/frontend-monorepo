import React from "react";
import { css } from "@emotion/react";
import {
  createEditor as createSlateEditor,
  Transforms,
  Editor,
  Range,
  Path,
} from "slate";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { withHistory } from "slate-history";
import isHotkey from "is-hotkey";
import { functionUtils } from "@shades/common";
import { createCss as createRichTextCss } from "./rich-text";
import createControlledParagraphLineBreaksPlugin from "../slate/plugins/controlled-paragraph-line-breaks";
import createInlineLinksPlugin from "../slate/plugins/inline-links";
import createUserMentionsPlugin from "../slate/plugins/user-mentions";
import { search, mergePlugins } from "../slate/utils";

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

const withTextCommands = (editor) => {
  editor.select = (target) => Transforms.select(editor, target);

  editor.search = (query, { at }) => search(editor, query, { at });

  editor.replaceAll = (text) => {
    Transforms.select(editor, []);
    editor.insertText(text);
  };

  editor.appendText = (text) => {
    Transforms.select(editor, []);
    Transforms.collapse(editor, { edge: "end" });
    editor.insertText(text);
  };

  editor.prependText = (text) => {
    Transforms.select(editor, []);
    Transforms.collapse(editor, { edge: "start" });
    editor.insertText(text);
  };

  return editor;
};

const withEditorCommands = (editor) => {
  editor.focus = () => ReactEditor.focus(editor);

  editor.clear = () => {
    editor.children = [{ type: "paragraph", children: [{ text: "" }] }];
    // Move cursor to start
    Transforms.select(editor, Editor.start(editor, []));
  };

  return editor;
};

const RichTextInput = React.forwardRef(
  (
    {
      value,
      onChange,
      onKeyDown,
      triggers = [],
      getUserMentionDisplayName,
      ...props
    },
    ref
  ) => {
    const { editor, handlers, customElementsByNodeType } = React.useMemo(() => {
      const editor = compose(
        withMarks,
        withTextCommands,
        withEditorCommands,
        withReact,
        withHistory
      )(createSlateEditor());

      const { middleware, elements, handlers } = mergePlugins([
        createControlledParagraphLineBreaksPlugin(),
        createInlineLinksPlugin(),
        createUserMentionsPlugin(),
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
        if (CustomComponent) {
          if (props.element.type === "user")
            return (
              <CustomComponent
                {...props}
                displayName={getUserMentionDisplayName(props.element.ref)}
              />
            );
          return <CustomComponent {...props} />;
        }
        return <Element {...props} />;
      },
      [customElementsByNodeType, getUserMentionDisplayName]
    );
    const renderLeaf = React.useCallback((props) => <Leaf {...props} />, []);

    React.useEffect(() => {
      ref.current = editor;
      // :this-is-fine:
      Editor.normalize(editor, { force: true });
    }, [ref, editor, onChange]);

    return (
      <Slate
        editor={editor}
        value={value}
        onChange={(value) => {
          handlers.onChange(value, editor);
          onChange(value);

          const findWordStart = (p = editor.selection.anchor) => {
            const prevPoint = Editor.before(editor, p, { unit: "character" });
            if (prevPoint == null) return p;
            const char = Editor.string(
              editor,
              Editor.range(editor, prevPoint, p)
            );
            if (char === " ") return p;
            return findWordStart(prevPoint);
          };

          const findWordEnd = (p = editor.selection.anchor) => {
            const nextPoint = Editor.after(editor, p, { unit: "character" });
            if (nextPoint == null) return p;
            const char = Editor.string(
              editor,
              Editor.range(editor, p, nextPoint)
            );
            if (char === " ") return p;
            return findWordEnd(nextPoint);
          };

          const getWordRange = (p = editor.selection.focus) => ({
            anchor: findWordStart(p),
            focus: findWordEnd(p),
          });

          for (let trigger of triggers) {
            switch (trigger.type) {
              case "word": {
                if (
                  editor.selection == null ||
                  !Range.isCollapsed(editor.selection)
                )
                  continue;

                const wordRange = getWordRange();
                const wordString = Editor.string(editor, wordRange);

                if (trigger.match == null || trigger.match(wordString))
                  trigger.handler(wordString, wordRange);
                break;
              }

              default:
                throw new Error();
            }
          }
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
