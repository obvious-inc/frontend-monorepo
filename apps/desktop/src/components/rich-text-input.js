import React from "react";
import { css } from "@emotion/react";
import {
  createEditor as createSlateEditor,
  Transforms,
  Editor,
  Range,
} from "slate";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { withHistory } from "slate-history";
import isHotkey from "is-hotkey";
import { function as functionUtils } from "@shades/common/utils";
import { createCss as createRichTextCss } from "./rich-text";
import createControlledParagraphLineBreaksPlugin from "../slate/plugins/controlled-paragraph-line-breaks";
import createListsPlugin from "../slate/plugins/lists";
import createQuotesPlugin from "../slate/plugins/quotes";
import createCalloutsPlugin from "../slate/plugins/callouts";
import createEmojiPlugin from "../slate/plugins/emojis";
import createInlineLinksPlugin from "../slate/plugins/inline-links";
import createHeadingsPlugin from "../slate/plugins/headings";
import createUserMentionsPlugin from "../slate/plugins/user-mentions";
import createChannelLinksPlugin from "../slate/plugins/channel-link";
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
  const findWordStart = (p = editor.selection.anchor) => {
    const prevPoint = Editor.before(editor, p, { unit: "offset" });
    if (prevPoint == null) return p;
    const char = Editor.string(editor, Editor.range(editor, prevPoint, p));
    if (char === "" || char.match(/\s/)) return p;
    return findWordStart(prevPoint);
  };

  const findWordEnd = (p = editor.selection.anchor) => {
    const nextPoint = Editor.after(editor, p, { unit: "offset" });
    if (nextPoint == null) return p;
    const char = Editor.string(editor, Editor.range(editor, p, nextPoint));
    if (char === "" || char.match(/\s/)) return p;
    return findWordEnd(nextPoint);
  };

  editor.getWordRange = (p = editor.selection.focus) => ({
    anchor: findWordStart(p),
    focus: findWordEnd(p),
  });

  // editor.select = (target) => Transforms.select(editor, target);

  editor.search = (query, { at }) => search(editor, query, { at });

  editor.replaceAll = (text) => {
    Transforms.select(editor, []);
    editor.insertText(text);
  };

  editor.replaceFirstWord = (text) => {
    const p = Editor.edges(editor, [])[0];
    const wordRange = editor.getWordRange(p);
    Transforms.select(editor, wordRange);
    editor.insertText(text);
  };

  editor.replaceCurrentWord = (text) => {
    const wordRange = editor.getWordRange();
    Transforms.select(editor, wordRange);
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
  const { string } = editor;

  editor.focus = () => {
    ReactEditor.focus(editor);
    // Focus doesn’t always work without this for some reason
    Transforms.select(editor, Editor.end(editor, []));
  };

  editor.clear = () => {
    editor.children = [{ type: "paragraph", children: [{ text: "" }] }];
    // Move cursor to start
    Transforms.select(editor, Editor.start(editor, []));
  };

  editor.string = (location = [], options) => string(location, options);

  return editor;
};

const RichTextInput = React.forwardRef(
  (
    {
      value,
      onChange,
      onKeyDown,
      disabled = false,
      inline = false,
      triggers = [],
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
        createListsPlugin({ inline }),
        createQuotesPlugin({ inline }),
        createCalloutsPlugin({ inline }),
        createHeadingsPlugin({ inline }),
        createUserMentionsPlugin(),
        createChannelLinksPlugin(),
        createInlineLinksPlugin(),
        createEmojiPlugin(),
      ]);

      return {
        editor: middleware(editor),
        customElementsByNodeType: elements,
        handlers,
      };
    }, [inline]);

    const renderElement = React.useCallback(
      (props) => {
        const CustomComponent = customElementsByNodeType[props.element.type];
        return CustomComponent == null ? (
          <Element {...props} />
        ) : (
          <CustomComponent {...props} />
        );
      },
      [customElementsByNodeType]
    );
    const renderLeaf = React.useCallback((props) => <Leaf {...props} />, []);

    React.useEffect(() => {
      if (ref != null) ref.current = editor;
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

          for (let trigger of triggers) {
            switch (trigger.type) {
              case "word": {
                if (
                  editor.selection == null ||
                  !Range.isCollapsed(editor.selection)
                )
                  continue;

                const wordRange = editor.getWordRange();
                const wordString = Editor.string(editor, wordRange, {
                  voids: true,
                });

                if (trigger.match == null || trigger.match(wordString))
                  trigger.handler(wordString, wordRange);

                break;
              }

              case "command": {
                if (
                  editor.selection == null ||
                  !Range.isCollapsed(editor.selection)
                )
                  continue;

                const string = Editor.string(editor, []);

                const isCommand = string
                  .split(" ")[0]
                  .match(/^\/([a-z][a-z-]*)?$/);

                if (!isCommand) {
                  trigger.handler(null);
                  break;
                }

                const parts = string.slice(1).split(" ");
                const [command, ...args] = parts;
                trigger.handler(
                  command,
                  args.map((a) => a.trim()).filter(Boolean)
                );

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
          readOnly={disabled}
          data-disabled={disabled || undefined}
          {...props}
        />
      </Slate>
    );
  }
);

const Element = (props) => {
  const { attributes, children, element } = props;

  switch (element.type) {
    case "heading-1":
      return <h1 {...attributes}>{children}</h1>;

    case "heading-2":
      return <h2 {...attributes}>{children}</h2>;

    case "bulleted-list":
      return <ul {...attributes}>{children}</ul>;

    case "numbered-list":
      return <ol {...attributes}>{children}</ol>;

    case "list-item":
      return <li {...attributes}>{children}</li>;

    case "quote":
      return <blockquote {...attributes}>{children}</blockquote>;

    case "callout":
      return <aside {...attributes}>{children}</aside>;

    case "paragraph":
      return <p {...attributes}>{children}</p>;

    default:
      console.warn(`Unsupported element type "${element.type}"`);
      return <p {...attributes}>{children}</p>;
  }
};

const Leaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) children = <strong>{children}</strong>;
  if (leaf.italic) children = <em>{children}</em>;
  if (leaf.strikethrough) children = <s>{children}</s>;

  return <span {...attributes}>{children}</span>;
};

export default RichTextInput;
