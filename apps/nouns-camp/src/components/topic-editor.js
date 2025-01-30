import React from "react";
import { css } from "@emotion/react";
import {
  AutoAdjustingHeightTextarea,
  ErrorBoundary,
} from "@shades/common/react";
import Link from "@shades/ui-web/link";
import Button from "@shades/ui-web/button";
import Input from "@shades/ui-web/input";
import useMatchDesktopLayout from "@/hooks/match-desktop-layout";
import RichTextEditor, {
  Provider as EditorProvider,
  Toolbar as EditorToolbar,
} from "./rich-text-editor.js";
import { MainContentContainer } from "./layout.js";
import { EditorRenderError, MarkdownPreviewDialog } from "./proposal-editor.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";

const TopicEditor = ({
  title,
  body,
  setTitle,
  setBody,
  setActions,
  proposerId,
  note,
  onSubmit,
  onDelete,
  hasPendingSubmit,
  submitLabel,
  submitDisabled,
  sidebarWidth = "28rem",
  sidebarGap = "6rem",
  sidebarContent,
  mode = "regular",
  pad = true,
}) => {
  const isDesktopLayout = useMatchDesktopLayout();

  const editorRef = React.useRef();

  const [showMarkdownPreview, setShowMarkdownPreview] = React.useState(false);

  const [updateMessage, setUpdateMessage] = React.useState("");

  return (
    <>
      <EditorProvider>
        <MainContentContainer pad={pad}>
          <AutoAdjustingHeightTextarea
            aria-label="Title"
            rows={1}
            value={title}
            onKeyDown={(e) => {
              const editor = editorRef.current;

              if (e.key === "ArrowDown") {
                e.preventDefault();
                editor.focus(editor.start([]));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const textBeforeSelection = e.target.value.slice(
                  0,
                  e.target.selectionStart,
                );
                const textAfterSelection = e.target.value.slice(
                  e.target.selectionEnd,
                );
                setTitle(textBeforeSelection);
                editor.insertNode(
                  {
                    type: "paragraph",
                    children: [{ text: textAfterSelection }],
                  },
                  { at: editor.start([]) },
                );
                editor.focus(editor.start([]));
              }
            }}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            autoFocus
            placeholder="Untitled discussion topic"
            css={(t) =>
              css({
                background: "none",
                fontSize: t.text.sizes.headerLarger,
                lineHeight: 1.15,
                width: "100%",
                outline: "none",
                fontWeight: t.text.weights.header,
                border: 0,
                padding: 0,
                color: t.colors.textHeader,
                margin: "0 0 0.3rem",
                "::placeholder": { color: t.colors.textMuted },
                "@media(min-width: 600px)": {
                  fontSize: t.text.sizes.huge,
                },
              })
            }
          />
          <div
            css={(t) =>
              css({
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.base,
                marginBottom: "2.4rem",
              })
            }
          >
            By <AccountPreviewPopoverTrigger accountAddress={proposerId} />
          </div>
        </MainContentContainer>

        <MainContentContainer
          pad={pad}
          sidebarWidth={sidebarWidth}
          sidebarGap={sidebarGap}
          sidebar={
            sidebarContent == null ? null : (
              <div
                data-stack-layout={!isDesktopLayout || undefined}
                css={(t) =>
                  css({
                    color: t.colors.textDimmed,
                    padding: "0 0 6rem",
                    "@media (min-width: 600px)": {
                      padding: "0",
                    },
                    em: {
                      fontStyle: "normal",
                      fontWeight: t.text.weights.emphasis,
                    },
                    "p + p": { marginTop: "2rem" },
                    "&[data-stack-layout]": { marginTop: "3.2rem" },
                  })
                }
              >
                {sidebarContent}
              </div>
            )
          }
        >
          <div css={css({ position: "relative" })}>
            <div
              css={(t) =>
                css({
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: t.colors.backgroundPrimary,
                })
              }
            >
              <div
                css={(t) =>
                  css({
                    border: "0.1rem solid",
                    borderColor: t.colors.borderLight,
                    borderTopLeftRadius: "0.6rem",
                    borderTopRightRadius: "0.6rem",
                    padding: "0.8rem",
                    background: t.colors.backgroundSecondary,
                  })
                }
              >
                <EditorToolbar />
              </div>
            </div>

            <div
              css={(t) =>
                css({
                  padding: "1.6rem",
                  border: "0.1rem solid",
                  borderColor: t.colors.borderLight,
                  borderBottomLeftRadius: "0.6rem",
                  borderBottomRightRadius: "0.6rem",
                  borderTop: 0,
                })
              }
            >
              <ErrorBoundary fallback={() => <EditorRenderError body={body} />}>
                <RichTextEditor
                  ref={editorRef}
                  value={body}
                  onChange={(e) => {
                    setBody(e);
                  }}
                  placeholder={`Use markdown shortcuts like "# " and "1. " to create headings and lists.`}
                  imagesMaxWidth={null}
                  imagesMaxHeight={680}
                  css={css({
                    // better for displaying transparent assets
                    ".image > img": {
                      background: "unset",
                    },
                  })}
                  style={{ flex: 1, minHeight: "12rem" }}
                />
              </ErrorBoundary>
            </div>
          </div>
          <div
            css={(t) =>
              css({
                textAlign: "right",
                padding: "0.8rem 0",
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.small,
                "p + p": { marginTop: "0.8rem" },
                ".middot": { margin: "0 0.4em" },
              })
            }
          >
            <p>
              {setActions != null && (
                <>
                  <Link
                    type="button"
                    component="button"
                    onClick={() => {
                      setActions([]);
                    }}
                    underline
                    variant="dimmed"
                  >
                    Turn into proposal candidate
                  </Link>
                  <span className="middot" role="separator">
                    &middot;
                  </span>
                </>
              )}
              <Link
                type="button"
                component="button"
                onClick={() => {
                  setShowMarkdownPreview((s) => !s);
                }}
                underline
                variant="dimmed"
              >
                View raw markdown
              </Link>
            </p>
            {note != null && <p>{note}</p>}
          </div>

          {mode === "edit" && (
            <div
              css={css({
                margin: "1.6rem 0",
                "@media (min-width: 600px)": {
                  margin: "0",
                },
              })}
            >
              <Input
                label="Update note (optional)"
                multiline
                aria-label="Update note"
                hint="Use this to explain or give context to your update."
                rows={2}
                placeholder="..."
                value={updateMessage}
                onChange={(e) => setUpdateMessage(e.target.value)}
              />
            </div>
          )}
          <div
            css={css({
              display: "flex",
              justifyContent: "flex-end",
              gap: "1.6rem",
              padding: "1.6rem 0 0",
            })}
          >
            <Button onClick={onDelete}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() =>
                onSubmit({
                  updateMessage:
                    updateMessage.trim() === "" ? null : updateMessage,
                })
              }
              isLoading={hasPendingSubmit}
              disabled={submitDisabled}
            >
              {submitLabel}
            </Button>
          </div>
        </MainContentContainer>
      </EditorProvider>

      {showMarkdownPreview && (
        <MarkdownPreviewDialog
          isOpen
          close={() => {
            setShowMarkdownPreview(false);
          }}
          title={title}
          body={body}
        />
      )}
    </>
  );
};

export default TopicEditor;
