import React from "react";
import { css } from "@emotion/react";
import {
  createEditor as createSlateEditor,
  Transforms,
  Editor,
  Range,
  Node,
  Path,
} from "slate";
import {
  Slate,
  Editable,
  withReact,
  ReactEditor,
  useFocused,
  useSelected,
} from "slate-react";
import { withHistory } from "slate-history";
import isHotkey from "is-hotkey";
import {
  function as functionUtils,
  url as urlUtils,
  markdown as markdownUtils,
  requestIdleCallback,
  getImageDimensionsFromUrl,
  isTouchDevice,
  reloadPageOnce,
} from "@shades/common/utils";
import { ErrorBoundary } from "@shades/common/react";
import Select from "./select.js";
import RichText, { createCss as createRichTextCss } from "./rich-text.js";
import createControlledParagraphLineBreaksPlugin from "./slate/plugins/controlled-paragraph-line-breaks.js";
import createSensibleVoidsPlugin from "./slate/plugins/sensible-voids.js";
import createListsPlugin from "./slate/plugins/lists.js";
import createQuotesPlugin from "./slate/plugins/quotes.js";
import createCodeBlocksPlugin from "./slate/plugins/code-blocks.js";
// import createCalloutsPlugin from "./slate/plugins/callouts.js";
import createHorizontalDividerPlugin from "./slate/plugins/horizontal-divider.js";
import createEmojiPlugin from "./slate/plugins/emojis.js";
import createInlineLinksPlugin from "./slate/plugins/inline-links.js";
import createImagesPlugin from "./slate/plugins/images.js";
import createHeadingsPlugin from "./slate/plugins/headings.js";
import createUserMentionsPlugin from "./slate/plugins/user-mentions.js";
import createChannelLinksPlugin from "./slate/plugins/channel-link.js";
import { search, mergePlugins, fromMessageBlocks } from "./slate/utils.js";

const FormDialog = React.lazy(() => import("./form-dialog.js"));
const Dialog = React.lazy(() => import("./dialog.js"));

export {
  isNodeEmpty,
  toMessageBlocks,
  fromMessageBlocks,
} from "./slate/utils.js";

export const isSelectionCollapsed = Range.isCollapsed;

const { compose } = functionUtils;

const markHotkeys = {
  "mod+b": "bold",
  "mod+i": "italic",
  "mod+shift+x": "strikethrough",
};

const Context = React.createContext();

export const Provider = ({ children }) => {
  const editorRef = React.useRef();
  const [linkDialogState, linkDialogActions] = useLinkDialog({ editorRef });
  const [imageDialogState, imageDialogActions] = useImageDialog({ editorRef });
  const [selection, setSelection] = React.useState(null);
  const [activeMarks, setActiveMarks] = React.useState([]);

  const contextValue = React.useMemo(
    () => ({
      editorRef,
      linkDialogState,
      linkDialogActions,
      imageDialogState,
      imageDialogActions,
      selection,
      setSelection,
      activeMarks,
      setActiveMarks,
    }),
    [
      linkDialogState,
      linkDialogActions,
      imageDialogState,
      imageDialogActions,
      editorRef,
      selection,
      setSelection,
      activeMarks,
      setActiveMarks,
    ],
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

const useLinkDialog = ({ editorRef }) => {
  const [state, setState] = React.useState(null);

  const open = React.useCallback(() => {
    const editor = editorRef.current;
    const linkMatch = editor.above({ match: (n) => n.type === "link" });

    if (linkMatch == null) {
      const selectedText =
        editor.selection == null || Range.isCollapsed(editor.selection)
          ? null
          : editor.string(editor.selection).trim();
      setState({
        label: selectedText,
        url: null,
        selection: editor.selection,
      });
      return;
    }

    const linkElement = linkMatch[0];

    setState({
      label: linkElement.label ?? "",
      url: linkElement.url ?? "",
      selection: editor.selection,
    });
  }, [editorRef]);

  const close = React.useCallback(() => {
    setState(null);
  }, []);

  return React.useMemo(
    () => [
      { ...state, isOpen: state != null },
      { open, close },
    ],
    [state, open, close],
  );
};

const useImageDialog = ({ editorRef }) => {
  const [state, setState] = React.useState(null);

  const open = React.useCallback(
    (at_) => {
      const editor = editorRef.current;
      const at = at_ ?? editor.selection;

      if (at == null) throw new Error();

      const [node] = editor.node(at) ?? [];

      setState({ url: node?.url, caption: node?.caption, at });
    },
    [editorRef],
  );

  const close = React.useCallback(() => {
    setState(null);
  }, []);

  return React.useMemo(
    () => [
      { ...state, isOpen: state != null },
      { open, close },
    ],
    [state, open, close],
  );
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
    const char = editor.string(Editor.range(editor, prevPoint, p));
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

  editor.focus = (location) => {
    return new Promise((resolve) => {
      // Whatever works
      requestIdleCallback(() => {
        editor.select(location ?? editor.end([]));
        ReactEditor.focus(editor);
        resolve();
      });
    });
  };

  editor.clear = () => {
    editor.children = [{ type: "paragraph", children: [{ text: "" }] }];
    // Move cursor to start
    editor.select(editor.start([]));
  };

  editor.string = (location = [], options) => string(location, options);

  editor.isFocused = () => ReactEditor.isFocused(editor);

  editor.print = (at) => {
    const nodes = at == null ? editor.children : editor.fragment(at);
    console.log(JSON.stringify(nodes, null, 2));
  };

  return editor;
};

const withVoidTableFallback = (editor) => {
  const { isVoid } = editor;

  editor.isVoid = (node) => node.type === "table" || isVoid(node);

  return editor;
};

const withSaneishDefaultBehaviors = (editor, { mode } = {}) => {
  const { insertData, normalizeNode, isInline } = editor;

  editor.normalizeNode = ([node, path]) => {
    if (path.length === 0) {
      // The editor should never be empty
      if (node.children.length === 0) {
        editor.insertNode(
          { type: "paragraph", children: [{ text: "" }] },
          { at: [0] },
        );
        return;
      }

      const lastNode = node.children.slice(-1)[0];

      // Always end with an empty paragraph in non-inline mode
      if (
        mode !== "inline" &&
        (lastNode.type !== "paragraph" || Node.string(lastNode) !== "")
      ) {
        editor.insertNode(
          { type: "paragraph", children: [{ text: "" }] },
          { at: [node.children.length] },
        );
        return;
      }
    }

    normalizeNode([node, path]);
  };

  editor.insertData = (data) => {
    const text = data.getData("text");

    if (text) {
      try {
        const nodes = fromMessageBlocks(markdownUtils.toMessageBlocks(text));

        // Insert single paragraph content inline
        if (nodes.length === 1 && nodes[0].type === "paragraph") {
          editor.withoutNormalizing(() => {
            for (const node of nodes[0].children) {
              editor.insertNode(node);
            }
          });
          return;
        }

        editor.withoutNormalizing(() => {
          editor.deleteFragment();

          const getParentBlockPath = () =>
            editor.above({ match: editor.isBlock })[1];

          const parentBlockPath = getParentBlockPath();

          const hasBlockParent = parentBlockPath.length !== 0;

          // Insert at start if we just deleted the whole document
          if (!hasBlockParent) {
            editor.insertNodes(nodes, { at: [0] });
            return;
          }

          // Insert at the parent block location if we’re in an empty block
          if (editor.string(parentBlockPath).trim() === "") {
            editor.insertNodes(nodes, { at: parentBlockPath });
            return;
          }

          // Break before insertion if we’re in a non-empty block
          editor.insertBreak();
          editor.insertNodes(nodes, { at: Path.next(parentBlockPath) });

          // If we pasted at the end of a block we’ll end up in an unwanted
          // empty paragraph, which we may safetly delete to place the selection
          // at the end of the last pasted block
          if (editor.string(getParentBlockPath()).trim() === "")
            editor.deleteBackward();
        });
      } catch (e) {
        console.warn(e);
        editor.insertText(text);
      }
      return;
    }

    insertData(data);
  };

  editor.isInline = (node) =>
    (node.children == null && node.text != null) || isInline(node);

  editor.isLeafBlock = () => false;

  return editor;
};

const RichTextEditor = React.forwardRef(
  (
    {
      value,
      onChange,
      onKeyDown,
      onBlur,
      onFocus,
      disabled = false,
      inline = false,
      triggers = [],
      imagesMaxWidth,
      imagesMaxHeight,
      renderElement: customRenderElement,
      ...props
    },
    ref,
  ) => {
    const {
      editorRef: internalEditorRef,
      linkDialogState,
      linkDialogActions,
      imageDialogState,
      imageDialogActions,
      setSelection,
      setActiveMarks,
    } = React.useContext(Context);

    const editorMode = inline ? "inline" : "normal";

    const { editor, handlers, customElementsByNodeType } = React.useMemo(() => {
      const { middleware, elements, handlers } = mergePlugins(
        [
          createUserMentionsPlugin,
          createChannelLinksPlugin,
          createInlineLinksPlugin,
          createEmojiPlugin,
          createSensibleVoidsPlugin,
          createHorizontalDividerPlugin,
          createImagesPlugin,
          createControlledParagraphLineBreaksPlugin,
          createListsPlugin,
          // Headings, quotes, and code block breaks take precedence over list breaks
          createHeadingsPlugin,
          createQuotesPlugin,
          createCodeBlocksPlugin,
        ].map((fn) => fn({ mode: editorMode })),
      );

      const editor = compose(
        middleware,
        withMarks,
        withTextCommands,
        withVoidTableFallback,
        withSaneishDefaultBehaviors,
        withEditorCommands,
        withReact,
        withHistory,
      )(createSlateEditor(), { mode: editorMode });

      return {
        editor,
        customElementsByNodeType: elements,
        handlers,
      };
    }, [editorMode]);

    const renderElement = (props_) => {
      if (customRenderElement != null) {
        const element = customRenderElement(props_);
        if (element != null) return element;
      }

      const props =
        props_.element.type === "link"
          ? {
              ...props_,
              openEditDialog: () => {
                linkDialogActions.open();
              },
            }
          : props_.element.type === "image"
            ? {
                ...props_,
                maxWidth: imagesMaxWidth,
                maxHeight: imagesMaxHeight,
                openEditDialog: () => {
                  const nodePath = ReactEditor.findPath(editor, props_.element);
                  imageDialogActions.open(nodePath);
                },
              }
            : props_;

      const CustomComponent = customElementsByNodeType[props.element.type];

      return CustomComponent == null ? (
        <Element {...props} />
      ) : (
        <CustomComponent {...props} />
      );
    };

    const renderLeaf = React.useCallback((props) => <Leaf {...props} />, []);

    React.useEffect(() => {
      if (ref != null) ref.current = editor;
      internalEditorRef.current = editor;
      // :this-is-fine:
      editor.normalize({ force: true });
    }, [ref, internalEditorRef, editor, onChange]);

    return (
      <>
        <Slate
          editor={editor}
          initialValue={value}
          onChange={(value) => {
            handlers.onChange(value, editor);
            const marks = editor.getMarks();
            setActiveMarks(marks == null ? [] : Object.keys(marks));
            setSelection(editor.selection);
            onChange?.(value, editor);

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
                    args.map((a) => a.trim()).filter(Boolean),
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
            onBlur={(e) => {
              setSelection(null);
              setActiveMarks([]);
              onBlur?.(e, editor);
            }}
            onFocus={(e) => {
              const marks = editor.getMarks();
              setActiveMarks(marks == null ? [] : Object.keys(marks));
              setSelection(editor.selection);
              onFocus?.(e, editor);
            }}
            css={(theme) => {
              const styles = createRichTextCss(theme);
              return css({
                ...styles,
                outline: "none",
                "a:hover": { textDecoration: "none" },
                "&[data-disabled]": {
                  color: theme.colors.textMuted,
                  cursor: "not-allowed",
                  "[data-slate-placeholder]": {
                    color: theme.colors.textMuted,
                  },
                },
                "[data-slate-placeholder]": {
                  color: theme.colors.inputPlaceholder,
                  opacity: "1 !important",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  top: 0,
                },
              });
            }}
            readOnly={disabled}
            data-disabled={disabled || undefined}
            {...props}
          />
        </Slate>

        {linkDialogState.isOpen && (
          <ErrorBoundary
            onError={() => {
              reloadPageOnce();
            }}
          >
            <React.Suspense fallback={null}>
              <Dialog
                isOpen
                onRequestClose={() => {
                  linkDialogActions.close();
                  editor.focus(linkDialogState.selection);
                }}
              >
                {({ titleProps }) => (
                  <LinkDialog
                    titleProps={titleProps}
                    dismiss={() => {
                      linkDialogActions.close();
                      editor.focus(linkDialogState.selection);
                    }}
                    initialLabel={linkDialogState.label}
                    initialUrl={linkDialogState.url}
                    onSubmit={async ({ label, url }) => {
                      linkDialogActions.close();
                      await editor.focus(linkDialogState.selection);
                      editor.insertLink(
                        { label, url },
                        { at: linkDialogState.selection },
                      );
                    }}
                  />
                )}
              </Dialog>
            </React.Suspense>
          </ErrorBoundary>
        )}

        {imageDialogState.isOpen && (
          <ErrorBoundary
            onError={() => {
              reloadPageOnce();
            }}
          >
            <React.Suspense fallback={null}>
              <Dialog
                isOpen
                onRequestClose={() => {
                  imageDialogActions.close();
                  editor.focus(imageDialogState.at);
                }}
              >
                {({ titleProps }) => (
                  <ImageDialog
                    titleProps={titleProps}
                    dismiss={() => {
                      imageDialogActions.close();
                      editor.focus(imageDialogState.at);
                    }}
                    initialUrl={imageDialogState.url}
                    initialCaption={imageDialogState.caption}
                    onSubmit={async ({ url, caption }) => {
                      imageDialogActions.close();
                      const [{ width, height }] = await Promise.all([
                        // TODO handle image error
                        getImageDimensionsFromUrl(url),
                        editor.focus(imageDialogState.at),
                      ]);
                      editor.insertImage(
                        { url, caption, width, height },
                        { at: imageDialogState.at },
                      );
                    }}
                  />
                )}
              </Dialog>
            </React.Suspense>
          </ErrorBoundary>
        )}
      </>
    );
  },
);

const Element = (props) => {
  const { attributes, children, element } = props;

  switch (element.type) {
    case "heading-1":
      return <h1 {...attributes}>{children}</h1>;

    case "heading-2":
      return <h2 {...attributes}>{children}</h2>;

    case "heading-3":
      return <h3 {...attributes}>{children}</h3>;

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

    case "code-block":
      return (
        <pre {...attributes}>
          <code>{children}</code>
        </pre>
      );

    case "table":
      return <VoidTable {...props} />;

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

const VoidTable = ({ attributes, children, element }) => {
  const selected = useSelected();
  const focused = useFocused();
  const isFocused = selected && focused;

  return (
    <div>
      <table
        {...attributes}
        contentEditable={false}
        data-focused={isFocused}
        css={(t) =>
          css({
            '&[data-focused="true"]': {
              boxShadow: t.shadows.focus,
            },
          })
        }
      >
        <RichText raw blocks={element.content} />
      </table>
      {children}
    </div>
  );
};

const transformableBlockTypes = [
  "paragraph",
  "heading-1",
  "heading-2",
  "heading-3",
  "quote",
  "code-block",
];

const toolbarActionsByKey = {
  "block-transform": {
    label: "Change block type",
  },
  "list-transform": {
    label: "Change list type",
  },
  "heading-transform": {
    icon: (
      <svg
        width="512"
        height="512"
        viewBox="0 0 512 512"
        style={{ width: "1.2rem" }}
      >
        <path
          fill="currentColor"
          d="M448 96v320h32a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16H320a16 16 0 0 1-16-16v-32a16 16 0 0 1 16-16h32V288H160v128h32a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-32a16 16 0 0 1 16-16h32V96H32a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16h160a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16h-32v128h192V96h-32a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16h160a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16z"
        />
      </svg>
    ),
  },
  "quote-transform": {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        style={{ width: "1.7rem" }}
      >
        <g fill="none" fillRule="evenodd">
          <path d="M24 0v24H0V0h24ZM12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036c-.01-.003-.019 0-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427c-.002-.01-.009-.017-.016-.018Zm.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092c.012.004.023 0 .029-.008l.004-.014l-.034-.614c-.003-.012-.01-.02-.02-.022Zm-.715.002a.023.023 0 0 0-.027.006l-.006.014l-.034.614c0 .012.007.02.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01l-.184-.092Z" />
          <path
            fill="currentColor"
            d="M11.778 4.371a1 1 0 0 1-.15 1.407c-.559.452-.924.886-1.163 1.276a2 2 0 1 1-2.46 1.792c-.024-.492.02-1.15.293-1.892c.326-.884.956-1.829 2.073-2.732a1 1 0 0 1 1.407.15ZM15 5a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5Zm0 4a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5ZM4 14a1 1 0 0 1 1-1h15a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h15a1 1 0 1 0 0-2H5ZM3.006 8.846a2 2 0 1 0 2.459-1.792c.239-.39.604-.824 1.164-1.276A1 1 0 1 0 5.37 4.222c-1.117.903-1.747 1.848-2.073 2.732a4.757 4.757 0 0 0-.292 1.892Z"
          />
        </g>
      </svg>
    ),
  },
  "code-block-transform": {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        style={{ width: "1.7rem" }}
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="m8 7l-5 5l5 5m8 0l5-5l-5-5"
        />
      </svg>
    ),
  },
  "toggle-mark-bold": {
    icon: "B",
    mark: "bold",
    props: {
      style: { fontWeight: "600" },
    },
  },
  "toggle-mark-italic": {
    icon: "i",
    mark: "italic",
    props: {
      style: { fontStyle: "italic" },
    },
  },
  "toggle-mark-strikethrough": {
    icon: "S",
    mark: "strikethrough",
    props: {
      style: { textDecoration: "line-through" },
    },
  },
  "insert-link": {
    icon: (
      <svg viewBox="0 0 64 64" style={{ width: "1.5rem" }}>
        <path
          d="m27.75,44.73l4.24,4.24-3.51,3.51c-2.34,2.34-5.41,3.51-8.49,3.51-6.63,0-12-5.37-12-12,0-3.07,1.17-6.14,3.51-8.49l10-10c2.34-2.34,5.41-3.51,8.49-3.51s6.14,1.17,8.49,3.51l1.41,1.41-4.24,4.24-1.41-1.41c-1.13-1.13-2.64-1.76-4.24-1.76s-5.11,2.62-6.24,3.76l-8,8c-1.13,1.13-1.76,2.64-1.76,4.24,0,3.31,2.69,6,6,6,1.6,0,3.11-.62,4.24-1.76l3.51-3.51ZM44,8c-3.07,0-6.14,1.17-8.49,3.51l-3.51,3.51,4.24,4.24,3.51-3.51c1.13-1.13,2.64-1.76,4.24-1.76,3.31,0,6,2.69,6,6,0,1.6-.62,3.11-1.76,4.24l-10,10c-1.13,1.13-2.64,1.76-4.24,1.76s-3.11-.62-4.24-1.76l-1.41-1.41-4.24,4.24,1.41,1.41c2.34,2.34,5.41,3.51,8.49,3.51s6.14-1.17,8.49-3.51l10-10c2.34-2.34,3.51-5.41,3.51-8.49,0-6.63-5.37-12-12-12Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  "insert-image": {
    icon: (
      <svg viewBox="0 0 64 64" style={{ width: "1.7rem" }}>
        <path
          d="m38,27c0-2.76,2.24-5,5-5s5,2.24,5,5-2.24,5-5,5-5-2.24-5-5Zm20-15v40H6V12h52Zm-6,6H12v26l14-14h4l16,16h6v-28Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
};

export const Toolbar = ({ disabled: disabled_, onFocus, onBlur, ...props }) => {
  const context = React.useContext(Context);

  if (context == null)
    throw new Error("`Toolbar` rendered without a parent `EditorProvider`");

  const {
    editorRef,
    selection,
    activeMarks,
    linkDialogActions,
    imageDialogActions,
  } = context;

  const [storedSelectionRangeRef, setStoredSelectionRangeRef] =
    React.useState(null);

  const disabled =
    storedSelectionRangeRef == null && (disabled_ || selection == null);

  const editor = editorRef.current;

  const [selectedBlockNode, selectedBlockPath] =
    editor?.above({
      match: (n) => !Editor.isEditor(n) && editor.isBlock(n),
    }) ?? [];

  const selectedListRootNodeEntry = editor?.above({
    match: (n) => editor.isListRoot?.(n) ?? false,
  });

  const inlineElementsAllowed =
    selectedBlockNode?.type === "paragraph" ||
    selectedBlockNode?.type === "quote";

  const selectedNodeIsTransformable =
    selectedBlockNode != null &&
    transformableBlockTypes.includes(selectedBlockNode.type);

  const blockTransformTargetOptions = [
    { value: "paragraph", label: "Text" },
    { value: "heading-1", label: "Heading 1" },
    { value: "heading-2", label: "Heading 2" },
    { value: "heading-3", label: "Heading 3" },
    // TODO
    // { value: "bulleted-list", label: "Bulleted list" },
    // { value: "numbered-list", label: "Numbered list" },
    { value: "code-block", label: "Code" },
    { value: "quote", label: "Quote" },
  ];

  const renderAction = (action) => {
    switch (action.key) {
      case "list-transform":
      case "block-transform": {
        const getProps = () => {
          switch (action.key) {
            case "list-transform":
              return {
                value: selectedListRootNodeEntry[0].type,
                options: [
                  { value: "bulleted-list", label: "Bulleted list" },
                  { value: "numbered-list", label: "Numbered list" },
                ],
                disabled,
              };

            case "block-transform":
              return {
                value: selectedBlockNode.type,
                options: [
                  ...blockTransformTargetOptions,
                  selectedBlockNode.type === "list-item" && {
                    value: "list-item",
                    label: "List item",
                  },
                  selectedBlockNode.type === "image" && {
                    value: "image",
                    label: "Image",
                  },
                ].filter(Boolean),
                disabled: disabled || !selectedNodeIsTransformable,
              };

            default:
              throw new Error();
          }
        };

        const props = getProps();

        return (
          <Select
            key={action.key}
            fullWidth={false}
            width="max-content"
            variant="transparent"
            size="small"
            aria-label={action.label}
            onBlur={() => {
              onBlur?.();
              storedSelectionRangeRef?.unref();
              setStoredSelectionRangeRef(null);
            }}
            onFocus={() => {
              onFocus?.();
              setStoredSelectionRangeRef(editor.rangeRef(editor.selection));
            }}
            onChange={(blockType) => {
              switch (action.key) {
                case "list-transform": {
                  editor.setNodes(
                    { type: blockType },
                    { at: selectedListRootNodeEntry[1] },
                  );
                  break;
                }

                case "block-transform": {
                  if (selectedBlockNode.type === "list-item") {
                    editor.withoutNormalizing(() => {
                      editor.setNodes({ type: blockType });
                      editor.unwrapNodes({
                        at: selectedBlockPath,
                        match: editor.isListRoot,
                        split: true,
                      });
                    });
                  } else {
                    editor.setNodes({ type: blockType });
                  }

                  break;
                }

                default:
                  new Error();
              }

              setStoredSelectionRangeRef(null);
              editor.focus(storedSelectionRangeRef.current);
              storedSelectionRangeRef.unref();
              onBlur?.(); // onBlur doesn’t seem to fire on iOS
            }}
            data-select
            {...props}
            {...action.props}
          />
        );
      }

      case "heading-transform":
        return (
          <button
            key={action.key}
            type="button"
            data-button
            disabled={disabled || !selectedNodeIsTransformable}
            data-active={selectedBlockNode?.type.startsWith("heading-")}
            {...action.props}
            onMouseDown={(e) => {
              e.preventDefault();

              if (!selectedBlockNode.type.startsWith("heading-")) {
                editor.setNodes({ type: "heading-1" });
                return;
              }

              const nextHeadingLevel =
                parseInt(selectedBlockNode.type.split("-")[1]) + 1;

              editor.setNodes({
                type:
                  nextHeadingLevel > 3
                    ? "paragraph"
                    : `heading-${nextHeadingLevel}`,
              });
            }}
          >
            {action.icon}
          </button>
        );

      case "quote-transform":
        return (
          <button
            key={action.key}
            type="button"
            data-button
            disabled={disabled || !selectedNodeIsTransformable}
            data-active={selectedBlockNode?.type === "quote"}
            {...action.props}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.setNodes({
                type:
                  selectedBlockNode.type === "quote" ? "paragraph" : "quote",
              });
            }}
          >
            {action.icon}
          </button>
        );

      case "code-block-transform":
        return (
          <button
            key={action.key}
            type="button"
            data-button
            disabled={disabled || !selectedNodeIsTransformable}
            data-active={selectedBlockNode?.type === "code-block"}
            {...action.props}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.setNodes({
                type:
                  selectedBlockNode.type === "code-block"
                    ? "paragraph"
                    : "code-block",
              });
            }}
          >
            {action.icon}
          </button>
        );

      case "toggle-mark-bold":
      case "toggle-mark-italic":
      case "toggle-mark-strikethrough":
        return (
          <button
            key={action.key}
            type="button"
            data-button
            disabled={disabled || !inlineElementsAllowed}
            data-active={activeMarks.includes(action.mark)}
            {...action.props}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.toggleMark(action.mark);
            }}
          >
            {action.icon}
          </button>
        );

      case "insert-link":
        return (
          <button
            key={action.key}
            type="button"
            data-button
            disabled={disabled || !inlineElementsAllowed}
            // data-active={activeMarks.includes(action.mark)}
            {...action.props}
            onMouseDown={(e) => {
              e.preventDefault();
              linkDialogActions.open();
            }}
          >
            {action.icon}
          </button>
        );

      case "insert-image":
        return (
          <button
            key={action.key}
            type="button"
            data-button
            disabled={disabled || !inlineElementsAllowed}
            // data-active={activeMarks.includes(action.mark)}
            {...action.props}
            onMouseDown={(e) => {
              e.preventDefault();
              imageDialogActions.open();
            }}
          >
            {action.icon}
          </button>
        );

      default:
        throw new Error();
    }
  };

  return (
    <div
      data-toolbar
      css={(t) =>
        css({
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: "0.3rem 0",
          flexWrap: "wrap",
          '[role="separator"]': {
            width: "0.1rem",
            height: "2rem",
            background: t.colors.borderLight,
            margin: "0 0.3rem",
          },
          "[data-button]": {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2.6rem",
            height: "2.6rem",
            borderRadius: "0.3rem",
            ":disabled": { color: t.colors.textMuted },
            "@media(hover: hover)": {
              ":not(:disabled)": {
                cursor: "pointer",
                ":hover": {
                  background: t.colors.backgroundModifierHover,
                },
              },
            },
            '&[data-active="true"]': { color: t.colors.textPrimary },
          },
          "[data-select]": {
            paddingTop: 0,
            paddingBottom: 0,
            minHeight: "2.6rem",
          },
        })
      }
      {...props}
    >
      {[
        !isTouchDevice() && selectedListRootNodeEntry != null
          ? ["list-transform"]
          : null,
        !isTouchDevice() && selectedNodeIsTransformable
          ? ["block-transform"]
          : null,
        ["toggle-mark-bold", "toggle-mark-italic", "toggle-mark-strikethrough"],
        isTouchDevice()
          ? ["heading-transform", "quote-transform", "code-block-transform"]
          : null,
        ["insert-link", "insert-image"],
      ]
        .filter((section) => section != null && section.length !== 0)
        .map((sectionActions, sectionIndex) => {
          const renderedSectionActions = sectionActions.map((actionKey) => {
            const action = toolbarActionsByKey[actionKey];
            return renderAction({ key: actionKey, ...action });
          });

          if (sectionIndex === 0) return renderedSectionActions;

          return (
            <React.Fragment key={sectionIndex}>
              <div role="separator" aria-orientation="vertical" />
              {renderedSectionActions}
            </React.Fragment>
          );
        })}
    </div>
  );
};

const LinkDialog = ({
  titleProps,
  dismiss,
  initialLabel,
  initialUrl,
  onSubmit,
}) => (
  <FormDialog
    titleProps={titleProps}
    dismiss={dismiss}
    title={initialUrl == null ? "Insert link" : "Edit link"}
    submitLabel={initialUrl == null ? "Insert link" : "Save changes"}
    submit={onSubmit}
    controls={[
      {
        key: "label",
        initialValue: initialLabel,
        label: "Text",
        type: "text",
      },
      {
        key: "url",
        initialValue: initialUrl,
        label: "URL",
        type: "text",
        validate: urlUtils.validate,
      },
    ].map(({ key, type, initialValue, label, validate }) => ({
      key,
      initialValue,
      type,
      label,
      required: validate != null,
      validate,
      size: "medium",
    }))}
    cancelLabel="Close"
  />
);

const ImageDialog = ({
  titleProps,
  dismiss,
  initialUrl,
  initialCaption,
  onSubmit,
}) => (
  <FormDialog
    titleProps={titleProps}
    dismiss={dismiss}
    title={initialUrl == null ? "Insert image" : "Edit image"}
    submitLabel={initialUrl == null ? "Insert image" : "Save changes"}
    submit={onSubmit}
    controls={[
      {
        key: "url",
        initialValue: initialUrl,
        label: "URL",
        type: "text",
        required: true,
        validate: urlUtils.validate,
        size: "medium",
      },
      {
        key: "caption",
        initialValue: initialCaption,
        label: "Caption (optional)",
        type: "text",
        size: "medium",
      },
    ]}
    cancelLabel="Close"
  />
);

// Wrapper to make rendering `Provider` optional for the consumer
const RichTextEditorWithProvider = React.forwardRef((props, ref) => {
  const context = React.useContext(Context);

  if (context != null) return <RichTextEditor ref={ref} {...props} />;

  return (
    <Provider>
      <RichTextEditor ref={ref} {...props} />
    </Provider>
  );
});

export default RichTextEditorWithProvider;
