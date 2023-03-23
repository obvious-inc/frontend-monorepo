import React from "react";
import { css } from "@emotion/react";
import {
  getImageFileDimensions,
  message as messageUtils,
} from "@shades/common/utils";
import {
  AtSign as AtSignIcon,
  CrossCircle as CrossCircleIcon,
  EmojiFace as EmojiFaceIcon,
  Gif as GifIcon,
  PaperClip as PaperClipIcon,
  PlusCircle as PlusCircleIcon,
} from "@shades/ui-web/icons";
import IconButton from "@shades/ui-web/icon-button";
import { isNodeEmpty, cleanNodes } from "../slate/utils";
import useCommands from "../hooks/commands";
import MessageInput from "./message-input";
import Spinner from "./spinner";

const { createEmptyParagraphElement } = messageUtils;

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
          ":hover .delete-button": { opacity: 1 },
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
              background: previewUrl == null ? undefined : `url(${previewUrl})`,
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
              background: theme.colors.channelInputBackground,
              borderRadius: "50%",
              boxShadow: `0 0 0 0.2rem ${theme.colors.channelInputBackground}`,
              svg: {
                width: "2.2rem",
                height: "auto",
                color: theme.colors.interactiveNormal,
              },
              ":hover svg": {
                color: theme.colors.interactiveHover,
              },
            })
          }
          onClick={() => {
            remove({ url });
          }}
        >
          <PlusCircleIcon style={{ transform: "rotate(45deg" }} />
        </button>
      </div>
    ))}
  </div>
);

const NewChannelMessageInput = React.memo(
  React.forwardRef(function NewMessageInput_(
    {
      submit,
      uploadImage,
      disabled,
      replyingToMessage,
      cancelReply,
      context,
      channelId,
      onInputChange,
      submitDisabled = false,
      ...props
    },
    editorRef_
  ) {
    const ref = React.useRef();
    const editorRef = editorRef_ ?? ref;

    const [pendingMessage, setPendingMessage] = React.useState(() => [
      createEmptyParagraphElement(),
    ]);

    const [isPending, setPending] = React.useState(false);

    const [imageUploads, setImageUploads] = React.useState([]);

    const isEmptyMessage =
      imageUploads.length === 0 && pendingMessage.every(isNodeEmpty);

    const fileInputRef = React.useRef();
    const uploadPromiseRef = React.useRef();
    const previousPendingMessageRef = React.useRef(pendingMessage);

    React.useEffect(() => {
      if (previousPendingMessageRef.current !== pendingMessage) {
        onInputChange?.(pendingMessage);
      }
      previousPendingMessageRef.current = pendingMessage;
    }, [pendingMessage, onInputChange]);

    const {
      execute: executeCommand_,
      isCommand,
      commands,
    } = useCommands({ context, channelId });

    const executeCommand = async (commandName, args) => {
      setPending(true);
      try {
        return await executeCommand_(commandName, {
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
      const blocks = cleanNodes(pendingMessage);

      const isEmpty = blocks.every(isNodeEmpty);

      if (
        isEmpty &&
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

        if (isCommand(commandName)) {
          await executeCommand(commandName, args);
          return;
        }
      }

      // Regular submit if we don’t have pending file uploads
      if (imageUploads.length === 0 && uploadPromiseRef.current == null) {
        editorRef.current.clear();
        return submit(blocks);
      }

      const submitWithAttachments = (attachments) => {
        editorRef.current.clear();
        setImageUploads([]);

        const attachmentsBlock = {
          type: "attachments",
          children: attachments.map((u) => ({
            type: "image-attachment",
            url: u.url,
            width: u.width,
            height: u.height,
          })),
        };

        return submit([...blocks, attachmentsBlock]);
      };

      if (uploadPromiseRef.current == null)
        return submitWithAttachments(imageUploads);

      // Craziness otherwise
      try {
        setPending(true);
        const attachments = await uploadPromiseRef.current.then();
        // Skippping `await` here to make sure we only mark as pending during
        // the upload phase. We don’t want to wait for the message creation to
        // complete since the UI is optimistic and adds the message right away
        submitWithAttachments(attachments);
      } catch (e) {
        return Promise.reject(e);
      } finally {
        setPending(false);
        editorRef.current.focus();
      }
    };

    return (
      <div css={css({ position: "relative" })}>
        {replyingToMessage && (
          <div
            css={(theme) =>
              css({
                position: "absolute",
                bottom: "100%",
                left: 0,
                width: "100%",
                display: "flex",
                alignItems: "center",
                background: theme.colors.backgroundSecondary,
                borderTopLeftRadius: "0.7rem",
                borderTopRightRadius: "0.7rem",
                padding: "0.6rem 1rem 0.6rem 1.1rem",
                fontSize: "1.2rem",
                color: "rgb(255 255 255 / 54%)",
              })
            }
          >
            <div css={css({ flex: 1, paddingTop: "0.2rem" })}>
              Replying to{" "}
              <span
                css={(t) =>
                  css({
                    fontWeight: "500",
                    color: replyingToMessage.author?.deleted
                      ? t.colors.textDimmed
                      : undefined,
                  })
                }
              >
                {replyingToMessage.author?.deleted
                  ? "Deleted user"
                  : replyingToMessage.author?.displayName}
              </span>
            </div>
            <button
              onClick={cancelReply}
              css={(theme) =>
                css({
                  color: theme.colors.interactiveNormal,
                  cursor: "pointer",
                  outline: "none",
                  borderRadius: "50%",
                  ":hover": { color: theme.colors.interactiveHover },
                  ":focus-visible": {
                    boxShadow: `0 0 0 0.2rem ${theme.colors.primary}`,
                  },
                })
              }
            >
              <CrossCircleIcon style={{ width: "1.6rem", height: "auto" }} />
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeMessage();
            editorRef.current.focus();
          }}
          css={(theme) =>
            css({
              padding: "1rem 1rem 1rem 1.6rem",
              maxHeight: "60vh",
              minHeight: "4.5rem",
              overflow: "auto",
              background: theme.colors.backgroundTertiary,
              borderRadius: "0.6rem",
              borderTopLeftRadius: replyingToMessage ? 0 : undefined,
              borderTopRightRadius: replyingToMessage ? 0 : undefined,
              fontSize: theme.fontSizes.channelMessages,
              "[role=textbox] [data-slate-placeholder]": {
                color: "rgb(255 255 255 / 40%)",
                opacity: "1 !important",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
              // Prevents iOS zooming in on input fields
              "@supports (-webkit-touch-callout: none)": {
                "[role=textbox]": { fontSize: "1.6rem" },
              },
            })
          }
          // TODO: Nicer pending state
          style={{ opacity: isPending ? 0.5 : 1 }}
        >
          <MessageInput
            ref={editorRef}
            initialValue={pendingMessage}
            onChange={(value) => {
              setPendingMessage(value);
            }}
            onKeyDown={(e) => {
              if (!e.isDefaultPrevented() && !e.shiftKey && e.key === "Enter") {
                e.preventDefault();
                executeMessage();
              }

              if (!e.isDefaultPrevented() && e.key === "Escape") {
                e.preventDefault();
                cancelReply?.();
              }
            }}
            executeCommand={executeCommand}
            commands={commands}
            disabled={disabled || isPending}
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
            style={{ display: "flex", alignItems: "center", marginTop: "1rem" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
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
                  disabled={disabled || isPending}
                >
                  <PaperClipIcon style={{ width: "1.6rem", height: "auto" }} />
                </IconButton>
                <IconButton
                  type="button"
                  dimmed
                  onClick={() => {
                    editorRef.current.insertText(":");
                    editorRef.current.focus();
                  }}
                  disabled={disabled || isPending}
                >
                  <EmojiFaceIcon style={{ width: "1.7rem", height: "auto" }} />
                </IconButton>
                <IconButton
                  type="button"
                  dimmed
                  // onClick={() => {}}
                  // disabled={disabled || isPending}
                  disabled
                >
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
                  disabled={disabled || isPending || props.members.length === 0}
                >
                  <AtSignIcon style={{ width: "1.6rem", height: "auto" }} />
                </IconButton>
              </div>
            </div>

            <IconButton
              disabled={submitDisabled || isEmptyMessage || isPending}
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
      </div>
    );
  })
);

export default NewChannelMessageInput;
