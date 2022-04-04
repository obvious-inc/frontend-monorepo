import throttle from "lodash.throttle";
import React from "react";
import { useParams, useNavigate } from "react-router";
import { css } from "@emotion/react";
import { useAuth, useAppScope, getImageFileDimensions } from "@shades/common";
import usePageVisibilityChangeListener from "../hooks/page-visibility-change-listener";
import stringifyMessageBlocks from "../slate/stringify";
import { createEmptyParagraph, isNodeEmpty, cleanNodes } from "../slate/utils";
import useCommands from "../hooks/commands";
import MessageInput from "./message-input";
import Spinner from "./spinner";
import { Header } from "./channel-layout";
import ChannelMessage from "./channel-message";
import { Hash as HashIcon, AtSign as AtSignIcon } from "./icons";
import {
  HamburgerMenu as HamburgerMenuIcon,
  PlusCircle as PlusCircleIcon,
  CrossCircle as CrossCircleIcon,
} from "./icons";
import { useMenuState } from "./app-layout";

const useChannelMessages = (channelId) => {
  const { actions, state, serverConnection } = useAppScope();

  const messages = state.selectChannelMessages(channelId);

  const sortedMessages = messages.sort(
    (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
  );

  // Fetch messages when switching channels
  React.useEffect(() => {
    actions.fetchMessages({ channelId });
  }, [actions, channelId]);

  // Fetch messages when tab get visibility
  usePageVisibilityChangeListener((state) => {
    if (state !== "visible") return;
    actions.fetchMessages({ channelId });
  });

  const lastMessage = sortedMessages.slice(-1)[0];

  // Make channels as read as new messages arrive
  React.useEffect(() => {
    if (lastMessage?.id == null || !serverConnection.isConnected) return;
    actions.markChannelRead({ channelId });
  }, [lastMessage?.id, channelId, actions, serverConnection.isConnected]);

  return sortedMessages;
};

export const ChannelBase = ({
  channel,
  members,
  selectChannelMemberWithUserId,
  createMessage,
  headerContent,
}) => {
  const { user } = useAuth();
  const { actions, state } = useAppScope();
  const navigate = useNavigate();

  const [pendingReplyMessageId, setPendingReplyMessageId] =
    React.useState(null);

  const { isEnabled: isMenuEnabled, toggle: toggleMenu } = useMenuState();

  const inputRef = React.useRef();

  const getUserMentionDisplayName = React.useCallback(
    (ref) => {
      const member = members.find((m) => m.id === ref);
      return member?.displayName ?? ref;
    },
    [members]
  );

  const throttledRegisterTypingActivity = React.useMemo(
    () =>
      throttle(() => actions.registerChannelTypingActivity(channel.id), 3000),
    [actions, channel.id]
  );

  const messages = useChannelMessages(channel.id);

  React.useEffect(() => {
    inputRef.current.focus();
  }, []);

  usePageVisibilityChangeListener((state) => {
    if (state === "visible") return;
    actions.fetchInitialData();
  });

  return (
    <div
      css={(theme) => css`
        flex: 1;
        min-width: min(30.6rem, 100vw);
        background: ${theme.colors.backgroundPrimary};
        display: flex;
        flex-direction: column;
      `}
    >
      <div
        css={css({
          height: "4.8rem",
          padding: "0 1.6rem",
          display: "flex",
          alignItems: "center",
          boxShadow:
            "0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05)",
        })}
      >
        {isMenuEnabled && (
          <button
            onClick={() => {
              toggleMenu();
            }}
            css={(theme) =>
              css({
                background: "none",
                border: 0,
                color: "white",
                cursor: "pointer",
                padding: "0.8rem 0.6rem",
                marginLeft: "-0.6rem",
                marginRight: "calc(-0.6rem + 1.6rem)",
                borderRadius: "0.4rem",
                ":hover": {
                  background: theme.colors.backgroundModifierHover,
                },
              })
            }
          >
            <HamburgerMenuIcon style={{ width: "1.5rem" }} />
          </button>
        )}
        {headerContent}
      </div>

      <div
        css={css`
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          overflow: auto;
          overscroll-behavior-y: contain;
          scroll-snap-type: y proximity;
        `}
      >
        <div
          css={(theme) => css`
            min-height: 0;
            font-size: ${theme.fontSizes.channelMessages};
            font-weight: 400;
            padding: 1.6rem 0 0;
          `}
        >
          {messages.map((m, i, ms) => (
            <ChannelMessage
              key={m.id}
              isDM={channel.kind === "dm"}
              serverId={channel.serverId}
              content={m.content}
              authorUserId={m.authorUserId}
              authorNick={
                m.authorServerMember?.displayName ?? m.authorUser?.displayName
              }
              avatarVerified={
                m.authorServerMember?.pfp?.verified ??
                m.authorUser?.pfp?.verified ??
                false
              }
              authorWalletAddress={
                m.authorServerMember?.walletAddress ??
                m.authorUser?.walletAddress
              }
              authorOnlineStatus={
                m.authorServerMember?.onlineStatus ?? m.authorUser?.onlineStatus
              }
              selectChannelMemberWithUserId={selectChannelMemberWithUserId}
              previousMessage={ms[i - 1]}
              reactions={m.reactions}
              createdAt={new Date(m.created_at)}
              isReply={m.isReply}
              hasPendingReply={pendingReplyMessageId === m.id}
              repliedMessage={m.repliedMessage}
              isEdited={m.edited_at != null}
              canEditMessage={user.id === m.authorUserId}
              update={(blocks) =>
                actions.updateMessage(m.id, {
                  blocks,
                  content: stringifyMessageBlocks(blocks),
                })
              }
              remove={() => actions.removeMessage(m.id)}
              addReaction={(emoji) => {
                const existingReaction = m.reactions.find(
                  (r) => r.emoji === emoji
                );

                if (existingReaction?.users.includes(user.id)) return;

                actions.addMessageReaction(m.id, { emoji });
              }}
              removeReaction={(emoji) =>
                actions.removeMessageReaction(m.id, { emoji })
              }
              initReply={() => {
                setPendingReplyMessageId(m.id);
                inputRef.current.focus();
              }}
              members={members}
              getUserMentionDisplayName={getUserMentionDisplayName}
              sendDirectMessageToAuthor={() => {
                const redirect = (c) => navigate(`/channels/@me/${c.id}`);
                const dmChannel = state.selectDmChannelFromUserId(
                  m.authorUserId
                );
                if (dmChannel != null) {
                  redirect(dmChannel);
                  return;
                }

                actions
                  .createChannel({
                    kind: "dm",
                    memberUserIds: [m.authorUserId],
                  })
                  .then(redirect);
              }}
            />
          ))}
          <div
            css={css`
              height: 1.6rem;
              scroll-snap-align: end;
            `}
          />
        </div>
      </div>
      <div css={css({ padding: "0 1.6rem 2.4rem", position: "relative" })}>
        <NewMessageInput
          ref={inputRef}
          isDM={channel.kind === "dm"}
          serverId={channel.serverId}
          channelId={channel.id}
          replyingToMessage={
            pendingReplyMessageId == null
              ? null
              : state.selectMessage(pendingReplyMessageId)
          }
          cancelReply={() => {
            setPendingReplyMessageId(null);
            inputRef.current.focus();
          }}
          uploadImage={actions.uploadImage}
          submit={(blocks) => {
            setPendingReplyMessageId(null);
            return createMessage({
              blocks,
              replyToMessageId: pendingReplyMessageId,
            });
          }}
          placeholder={
            channel.kind === "dm"
              ? `Message ${channel.name}`
              : `Message #${channel.name}`
          }
          members={members}
          getUserMentionDisplayName={getUserMentionDisplayName}
          onInputChange={() => {
            throttledRegisterTypingActivity();
          }}
        />
        {channel.typingMembers.filter((m) => m.id !== user.id).length > 0 && (
          <TypingIndicator members={channel.typingMembers} />
        )}
      </div>
    </div>
  );
};

const TypingIndicator = ({ members }) => (
  <div
    css={(theme) =>
      css({
        position: "absolute",
        left: 0,
        bottom: 0,
        padding: "0 1.5rem 0.4rem 6.5rem",
        pointerEvents: "none",
        color: theme.colors.textHeaderSecondary,
        width: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        lineHeight: 1.4,
        fontSize: theme.fontSizes.tiny,
        strong: { fontWeight: "600" },
      })
    }
  >
    {/* <svg width="24.5" height="7"> */}
    {/*   <g> */}
    {/*     <circle cx="3.5" cy="3.5" r="3.5" fill="currentColor" /> */}
    {/*     <circle cx="12.25" cy="3.5" r="3.5" fill="currentColor" /> */}
    {/*     <circle cx="21" cy="3.5" r="3.5" fill="currentColor" /> */}
    {/*   </g> */}
    {/* </svg> */}
    <span aria-live="polite" aria-atomic="true">
      {members.length === 1 ? (
        <strong>{members[0].displayName}</strong>
      ) : members.length === 2 ? (
        <></>
      ) : (
        members.map((m, i, ms) => {
          if (i === 0) return <strong key={m.id}>{m.displayName}</strong>;
          const isLast = i === ms.length - 1;
          if (isLast)
            return (
              <React.Fragment key={m.id}>
                {" "}
                , and<strong>{m.displayName}</strong>
              </React.Fragment>
            );
          return (
            <React.Fragment key={m.id}>
              {" "}
              , <strong>{m.displayName}</strong>
            </React.Fragment>
          );
        })
      )}{" "}
      is typing...
    </span>
  </div>
);

const NewMessageInput = React.forwardRef(
  (
    {
      submit,
      uploadImage,
      replyingToMessage,
      cancelReply,
      isDM,
      serverId,
      channelId,
      onInputChange,
      ...props
    },
    editorRef
  ) => {
    const [pendingMessage, setPendingMessage] = React.useState(() => [
      createEmptyParagraph(),
    ]);

    const [isPending, setPending] = React.useState(false);

    const [imageUploads, setImageUploads] = React.useState([]);

    const fileInputRef = React.useRef();
    const uploadPromiseRef = React.useRef();
    const previousPendingMessageRef = React.useRef(pendingMessage);

    React.useEffect(() => {
      if (previousPendingMessageRef.current !== pendingMessage) {
        onInputChange();
      }
      previousPendingMessageRef.current = pendingMessage;
    }, [pendingMessage, onInputChange]);

    const {
      execute: executeCommand,
      isCommand,
      commands,
    } = useCommands({
      context: isDM ? "dm" : "server-channel",
      serverId,
      channelId,
    });

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
          setPending(true);
          try {
            await executeCommand(commandName, {
              args,
              editor: editorRef.current,
            });
          } catch (e) {
            alert(e.message);
          }
          setPending(false);
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
        // Only mark as pending during the upload phase. We don’t want to wait
        // for the message creation to complete since the UI is optimistic
        // and adds the message right away
        setPending(false);
        submitWithAttachments(attachments);
      } catch (e) {
        setPending(false);
        return Promise.reject(e);
      }
    };

    React.useEffect(() => {
      if (isPending) return;
      editorRef.current.focus();
    }, [isPending, editorRef]);

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executeMessage();
        }}
        css={(theme) =>
          css({
            position: "relative",
            padding: "1rem",
            background: theme.colors.channelInputBackground,
            borderRadius: "0.7rem",
            borderTopLeftRadius: replyingToMessage ? 0 : undefined,
            borderTopRightRadius: replyingToMessage ? 0 : undefined,
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
              <span css={css({ fontWeight: "500" })}>
                {replyingToMessage.authorServerMember?.displayName}
              </span>
            </div>
            <button
              onClick={cancelReply}
              css={(theme) =>
                css({
                  color: theme.colors.interactiveNormal,
                  cursor: "pointer",
                  ":hover": { color: theme.colors.interactiveHover },
                })
              }
            >
              <CrossCircleIcon style={{ width: "1.6rem", height: "auto" }} />
            </button>
          </div>
        )}
        <div
          css={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0,1fr)",
            gridGap: "1.2rem",
            alignItems: "flex-start",
            paddingLeft: "0.3rem",
          }}
        >
          <button
            type="button"
            onClick={() => {
              fileInputRef.current.click();
            }}
            disabled={isPending}
            css={(theme) =>
              css({
                cursor: "pointer",
                color: theme.colors.interactiveNormal,
                svg: {
                  display: "block",
                  width: "2.4rem",
                  height: "auto",
                },
                "&[disabled]": { pointerEvents: "none" },
                ":hover": {
                  color: theme.colors.interactiveHover,
                },
              })
            }
          >
            <PlusCircleIcon />
          </button>

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
            }}
            commands={commands}
            disabled={isPending}
            {...props}
          />
        </div>

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
                      console.log(uploadedFile);
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
  }
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

const Channel = () => {
  const params = useParams();
  const { state, actions } = useAppScope();
  const { isEnabled: isMenuEnabled } = useMenuState();

  const channel = state.selectChannel(params.channelId);

  if (channel == null)
    return (
      <div
        css={(theme) =>
          css({ background: theme.colors.backgroundPrimary, flex: 1 })
        }
      />
    );

  const members =
    channel.kind === "dm"
      ? channel.memberUserIds.map(state.selectUser)
      : state.selectServerMembers(params.serverId);

  return (
    <ChannelBase
      channel={channel}
      members={members}
      createMessage={({ blocks, replyToMessageId }) => {
        return actions.createMessage({
          server: channel.kind === "dm" ? undefined : params.serverId,
          channel: params.channelId,
          content: stringifyMessageBlocks(blocks),
          blocks,
          replyToMessageId,
        });
      }}
      selectChannelMemberWithUserId={(userId) =>
        channel.kind === "dm"
          ? state.selectUser(userId)
          : state.selectServerMemberWithUserId(params.serverId, userId)
      }
      headerContent={
        <>
          {!isMenuEnabled && (
            <div
              css={(theme) =>
                css({ color: theme.colors.textMuted, marginRight: "0.9rem" })
              }
            >
              {channel.kind === "dm" ? (
                <AtSignIcon style={{ width: "2.2rem" }} />
              ) : (
                <HashIcon style={{ width: "1.9rem" }} />
              )}
            </div>
          )}
          <Header>{channel.name}</Header>
        </>
      }
    />
  );
};

export default Channel;
