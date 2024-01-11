import React from "react";
import { css } from "@emotion/react";
import {
  getImageFileDimensions,
  message as messageUtils,
} from "@shades/common/utils";
import EmojiPicker from "@shades/ui-web/emoji-picker";
import {
  AtSign as AtSignIcon,
  EmojiFace as EmojiFaceIcon,
  Gif as GifIcon,
  PaperClip as PaperClipIcon,
  PlusCircle as PlusCircleIcon,
} from "./icons.js";
import IconButton from "./icon-button.js";
import {
  isNodeEmpty,
  toMessageBlocks,
  fromMessageBlocks,
} from "./rich-text-editor.js";
import RichTextEditorWithAutoComplete from "./rich-text-editor-with-auto-complete.js";
import Spinner from "./spinner.js";

const {
  createEmptyParagraphElement,
  withoutAttachments,
  filter: filterMessageNodes,
} = messageUtils;

const imageUploadsToAttachmentsBlock = (imageUploads) => ({
  type: "attachments",
  children: imageUploads.map((u) => ({
    type: "image-attachment",
    url: u.url,
    width: u.width,
    height: u.height,
  })),
});

const MessageEditorForm = React.memo(
  React.forwardRef(function NewMessageInput_(
    {
      initialValue, // Message block array
      submit,
      uploadImage,
      inline = false,
      disabled = false,
      submitDisabled = false,
      fileUploadDisabled = false,
      allowEmptySubmit = false,
      commands: commandsByName = {},
      onChange,
      onKeyDown,
      renderSubmitArea,
      header,
      containerProps,
      ...props
    },
    forwardedEditorRef
  ) {
    const fallbackEditorRef = React.useRef();
    const editorRef = forwardedEditorRef ?? fallbackEditorRef;

    const [pendingSlateNodes, setPendingSlateNodes] = React.useState(() => {
      if (initialValue == null) return [createEmptyParagraphElement()];
      const nodes = fromMessageBlocks(withoutAttachments(initialValue));
      if (nodes.length === 0) return [createEmptyParagraphElement()];
      return nodes;
    });

    const [isPending, setPending] = React.useState(false);

    const [imageUploads, setImageUploads] = React.useState(() => {
      if (initialValue == null) return [];

      const imageAttachments =
        filterMessageNodes(
          (n) => n.type === "attachments" || n.type === "image-attachment",
          initialValue
        )[0]?.children ?? [];

      return imageAttachments.map((a) => ({ ...a, id: a.url }));
    });

    const [isEmojiPickerOpen, setEmojiPickerOpen] = React.useState(false);

    const isEmptyMessage =
      imageUploads.length === 0 && pendingSlateNodes.every(isNodeEmpty);

    const fileInputRef = React.useRef();
    const uploadPromiseRef = React.useRef();
    const previousPendingSlateNodesRef = React.useRef(pendingSlateNodes);

    React.useEffect(() => {
      if (previousPendingSlateNodesRef.current !== pendingSlateNodes) {
        onChange?.({
          rawRichTextNodes: pendingSlateNodes,
          getValue: () => {
            if (imageUploads.length === 0)
              return toMessageBlocks(pendingSlateNodes);

            return [
              ...toMessageBlocks(pendingSlateNodes),
              imageUploadsToAttachmentsBlock(imageUploads),
            ];
          },
        });
      }
      previousPendingSlateNodesRef.current = pendingSlateNodes;
    }, [pendingSlateNodes, imageUploads, onChange]);

    const executeCommand = async (commandName, args) => {
      setPending(true);
      try {
        const command = commandsByName[commandName];
        return await command.execute({
          submit,
          args,
          editor: editorRef.current,
        });
      } catch (e) {
        alert(e.message);
      } finally {
        setPending(false);
        editorRef.current.focus();
      }
    };

    const executeMessage = async () => {
      const blocks = toMessageBlocks(pendingSlateNodes);

      if (
        !allowEmptySubmit &&
        messageUtils.isEmpty(blocks) &&
        // We want to allow "empty" messages if it has attachements
        imageUploads.length === 0
      )
        return;

      const messageString = editorRef.current.string();

      if (messageString.startsWith("/")) {
        const [commandName, ...args] = messageString
          .slice(1)
          .split(" ")
          .map((s) => s.trim())
          .filter(Boolean);

        if (Object.keys(commandsByName).includes(commandName)) {
          await executeCommand(commandName, args);
          return;
        }
      }

      if (submitDisabled) return;

      setPending(true);

      try {
        // Await any pending attachment uploads
        const imageUploads_ =
          uploadPromiseRef.current == null
            ? imageUploads
            : await uploadPromiseRef.current.then();

        const blocksWithAttachments =
          imageUploads_.length === 0
            ? blocks
            : [...blocks, imageUploadsToAttachmentsBlock(imageUploads_)];

        await submit(blocksWithAttachments);
      } finally {
        setPending(false);
        setImageUploads([]);
        editorRef.current.clear();
        editorRef.current.focus();
      }
    };

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executeMessage();
          editorRef.current.focus();
        }}
        style={{
          borderTopLeftRadius: header != null ? 0 : undefined,
          borderTopRightRadius: header != null ? 0 : undefined,
        }}
        {...containerProps}
        css={(t) => [
          css({
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "1rem 1rem 1rem 1.6rem",
            background: t.colors.backgroundTertiary,
            borderRadius: "0.6rem",
            fontSize: t.text.sizes.large,
          }),
          containerProps?.css,
        ]}
      >
        {header != null && (
          <div
            css={(t) =>
              css({
                position: "absolute",
                bottom: "100%",
                left: 0,
                width: "100%",
                background: t.light
                  ? t.colors.backgroundQuarternary
                  : t.colors.backgroundSecondary,
                borderTopLeftRadius: "0.7rem",
                borderTopRightRadius: "0.7rem",
                padding: "0.6rem 1rem 0.6rem 1.1rem",
                fontSize: "1.2rem",
                color: t.colors.textDimmed,
              })
            }
          >
            {header}
          </div>
        )}

        <RichTextEditorWithAutoComplete
          ref={editorRef}
          inline={inline}
          initialValue={pendingSlateNodes}
          onChange={(nodes) => {
            setPendingSlateNodes(nodes);
          }}
          onKeyDown={(e) => {
            if (
              inline &&
              !e.isDefaultPrevented() &&
              !e.shiftKey &&
              e.key === "Enter"
            ) {
              e.preventDefault();
              executeMessage();
            }

            onKeyDown?.(e);
          }}
          executeCommand={executeCommand}
          commands={commandsByName}
          disabled={disabled || isPending}
          css={css({
            overflow: "auto",
            maxHeight: "60vh",
          })}
          {...props}
        />

        {imageUploads.length !== 0 && (
          <div
            css={css({
              overflow: "auto",
              paddingTop: "1.2rem",
              pointerEvents: isPending ? "none" : "all",
            })}
          >
            <AttachmentList
              items={imageUploads}
              remove={({ url }) => {
                setImageUploads((fs) => fs.filter((f) => f.url !== url));
              }}
            />
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          <div style={{ maxWidth: "100%", overflow: "auto" }}>
            <div
              style={{
                display: "grid",
                gridAutoColumns: "auto",
                gridAutoFlow: "column",
                gridGap: "0.5rem",
                justifyContent: "flex-start",
                alignItems: "center",
              }}
            >
              <IconButton
                dimmed
                type="button"
                onClick={() => {
                  fileInputRef.current.click();
                }}
                disabled={disabled || isPending || fileUploadDisabled}
              >
                <PaperClipIcon style={{ width: "1.6rem", height: "auto" }} />
              </IconButton>
              <EmojiPicker
                width="31.6rem"
                height="28.4rem"
                placement="top"
                isOpen={isEmojiPickerOpen}
                onOpenChange={(open) => {
                  setEmojiPickerOpen(open);
                }}
                onSelect={(emoji) => {
                  setEmojiPickerOpen(false);
                  editorRef.current.insertEmoji(emoji, {
                    at: editorRef.current.selection,
                  });
                  editorRef.current.focus(editorRef.current.selection);
                }}
                trigger={
                  <IconButton
                    type="button"
                    dimmed
                    onClick={() => {
                      editorRef.current.insertText(":");
                      editorRef.current.focus();
                    }}
                    disabled={disabled || isPending}
                  >
                    <EmojiFaceIcon
                      style={{ width: "1.7rem", height: "auto" }}
                    />
                  </IconButton>
                }
              />
              <IconButton type="button" dimmed disabled>
                <GifIcon style={{ width: "1.6rem", height: "auto" }} />
              </IconButton>
              <div
                css={(t) =>
                  css({
                    width: "0.1rem",
                    margin: "0 0.3rem",
                    height: "1.3rem",
                    background: t.colors.borderLight,
                  })
                }
              />
              <IconButton
                type="button"
                dimmed
                onClick={() => {
                  editorRef.current.insertText("@");
                  editorRef.current.focus();
                }}
                disabled={
                  disabled ||
                  isPending ||
                  props.members == null ||
                  props.members.length === 0
                }
              >
                <AtSignIcon style={{ width: "1.6rem", height: "auto" }} />
              </IconButton>
            </div>
          </div>

          {typeof renderSubmitArea === "function" ? (
            renderSubmitArea({ isPending })
          ) : (
            <div
              style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}
            >
              <IconButton
                disabled={
                  disabled ||
                  submitDisabled ||
                  (!allowEmptySubmit && isEmptyMessage) ||
                  isPending
                }
                css={(t) => css({ color: t.colors.primary })}
                type="submit"
              >
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <path
                    fill="currentColor"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M2.25 2.25 17.75 10l-15.5 7.75v-4.539a1.5 1.5 0 0 1 1.46-1.5l6.54-.171a1.54 1.54 0 0 0 0-3.08l-6.54-.172a1.5 1.5 0 0 1-1.46-1.5V2.25Z"
                  />
                </svg>
              </IconButton>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => {
            editorRef.current.focus();

            const filesToUpload = [...e.target.files];

            setImageUploads((fs) => [
              ...fs,
              ...filesToUpload.map((f) => ({
                name: encodeURIComponent(f.name),
                url: URL.createObjectURL(f),
              })),
            ]);

            fileInputRef.current.value = "";

            let lastImageUploads = imageUploads;

            // Buckle up!
            uploadPromiseRef.current = Promise.all([
              uploadPromiseRef.current ?? Promise.resolve(),
              ...filesToUpload.map((file) =>
                Promise.all([
                  getImageFileDimensions(file),
                  uploadImage({ files: [file] }).catch(() => {
                    setImageUploads((fs) => {
                      const newImageUploads = fs.filter(
                        (f) => f.name !== file.name
                      );
                      lastImageUploads = newImageUploads;
                      return newImageUploads;
                    });
                    const error = new Error(
                      `Could not upload file "${file.name}"`
                    );
                    alert(error.message);
                    return Promise.reject(error);
                  }),
                ]).then(([dimensions, [uploadedFile]]) => {
                  setImageUploads((fs) => {
                    const newImageUploads = fs.map((f) => {
                      if (!uploadedFile.filename.endsWith(f.name)) return f;
                      return {
                        id: uploadedFile.id,
                        name: uploadedFile.filename,
                        url: uploadedFile.variants.find((url) =>
                          url.endsWith("/public")
                        ),
                        previewUrl: f.url,
                        ...dimensions,
                      };
                    });

                    lastImageUploads = newImageUploads;
                    return newImageUploads;
                  });
                })
              ),
            ]).then(() => {
              uploadPromiseRef.current = null;
              return lastImageUploads;
            });
          }}
          hidden
        />
        <input type="submit" hidden />
      </form>
    );
  })
);

const AttachmentList = ({ items, remove }) => (
  <div
    css={(theme) =>
      css({
        display: "grid",
        gridAutoColumns: "max-content",
        gridAutoFlow: "column",
        justifyContent: "flex-start",
        gridGap: "1rem",
        img: {
          display: "block",
          width: "6rem",
          height: "6rem",
          borderRadius: "0.5rem",
          objectFit: "cover",
          background: theme.colors.backgroundSecondary,
        },
      })
    }
  >
    {items.map(({ id, url, previewUrl }) => (
      <div
        key={url}
        css={css({
          position: "relative",
          ".delete-button": { opacity: 0 },
          "@media (hover: hover)": {
            ":hover .delete-button": { opacity: 1 },
          },
        })}
      >
        <button
          type="button"
          onClick={() => {
            window.open(url, "_blank");
          }}
          css={css({
            display: "block",
            cursor: "pointer",
          })}
        >
          <img
            src={url}
            style={{
              transition: "0.1s opacity",
              opacity: id == null ? 0.7 : 1,
              background:
                url == null && previewUrl == null
                  ? undefined
                  : `url(${url ?? previewUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        </button>

        {id == null && (
          <div
            style={{
              pointerEvents: "none",
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translateX(-50%) translateY(-50%)",
            }}
            css={(theme) => css({ color: theme.colors.interactiveNormal })}
          >
            <Spinner />
          </div>
        )}

        <button
          type="button"
          className="delete-button"
          css={(theme) =>
            css({
              position: "absolute",
              top: 0,
              right: 0,
              transform: "translateX(50%) translateY(-50%)",
              cursor: "pointer",
              background: theme.colors.inputBackground,
              borderRadius: "50%",
              boxShadow: `0 0 0 0.2rem ${theme.colors.inputBackground}`,
              color: theme.colors.textDimmed,
              "@media (hover: hover)": {
                ":hover": {
                  color: theme.colors.textDimmedModifierHover,
                },
              },
            })
          }
          onClick={() => {
            remove({ url });
          }}
        >
          <PlusCircleIcon
            style={{
              width: "2.2rem",
              height: "auto",
              transform: "rotate(45deg",
            }}
          />
        </button>
      </div>
    ))}
  </div>
);

export default MessageEditorForm;
