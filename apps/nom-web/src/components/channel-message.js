import getDayOfTheMonth from "date-fns/getDate";
import isDateToday from "date-fns/isToday";
import isDateYesterday from "date-fns/isYesterday";
import React from "react";
import { useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
import {
  useActions,
  useSelectors,
  useMessageEmbeds,
  useMe,
  useUsers,
  useMessage,
  useUser,
  useChannel,
  useChannelMembers,
  useHasReactedWithEmoji,
  useMessageReactions,
  useSortedMessageReplies,
  useEmojiById,
} from "@shades/common/app";
import { message as messageUtils } from "@shades/common/utils";
import {
  useLatestCallback,
  useMatchMedia,
  useHover,
} from "@shades/common/react";
import Button from "@shades/ui-web/button";
import {
  DotsHorizontal as DotsHorizontalIcon,
  EditPen as EditPenIcon,
  ReplyArrow as ReplyArrowIcon,
  EmojiFace as EmojiFaceIcon,
  JoinArrowRight as JoinArrowRightIcon,
} from "@shades/ui-web/icons";
import AccountAvatar from "@shades/ui-web/account-avatar";
import InlineUserButton from "@shades/ui-web/inline-user-button";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import * as Toolbar from "@shades/ui-web/toolbar";
import * as Tooltip from "@shades/ui-web/tooltip";
import Emoji from "@shades/ui-web/emoji";
import EmojiPicker from "@shades/ui-web/emoji-picker";
import MessageEditorForm from "@shades/ui-web/message-editor-form";
import Link from "@shades/ui-web/link";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import FormattedDate from "./formatted-date";
import RichText from "./rich-text";

const ONE_MINUTE_IN_MILLIS = 1000 * 60;

const ChannelMessage = React.memo(function ChannelMessage_({
  messageId,
  previousMessageId,
  hasPendingReply,
  initReply: initReply_,
  isTouchFocused,
  setTouchFocused,
  layout,
  scrollToMessage,
  threads = false,
  showLeftColumn = true,
  showReplyTargetMessages = true,
  horizontalPadding = "1.6rem",
  ...containerProps
}) {
  const editInputRef = React.useRef();
  const containerRef = React.useRef();

  const actions = useActions();
  const selectors = useSelectors();

  const { addMessageReaction } = actions;

  const navigate = useNavigate();

  const me = useMe();
  const message = useMessage(messageId, { replies: true });
  const channel = useChannel(message?.channelId);
  const previousMessage = useMessage(previousMessageId);
  const members = useChannelMembers(message?.channelId);

  const isAdmin =
    me != null && channel != null && me.id === channel.ownerUserId;

  const [isHovering, hoverHandlers] = useHover();
  const [isEmojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [isEditing, setEditingMessage] = React.useState(false);

  const compact = layout === "compact";

  const showAsFocused =
    !isEditing && (isTouchFocused || isHovering || isEmojiPickerOpen);

  const isDirectMessage = channel != null && channel.kind === "dm";
  const isOwnMessage = me?.id === message.authorUserId;

  const allowEdit =
    !message.isSystemMessage &&
    !message.isAppMessage &&
    me?.id === message.authorUserId;

  const allowDirectMessages = me != null;

  const createdAtDate = React.useMemo(
    () => new Date(message.createdAt),
    [message.createdAt]
  );

  const initReply = React.useCallback(
    () => initReply_(messageId),
    [messageId, initReply_]
  );

  const initEdit = React.useCallback(() => {
    setEditingMessage(true);
  }, []);

  const showSimplifiedMessage =
    !message.isReply &&
    previousMessage != null &&
    previousMessage.authorId === message.authorId &&
    createdAtDate - new Date(previousMessage.createdAt) <
      5 * ONE_MINUTE_IN_MILLIS;

  const reactions = message.reactions;

  const save = React.useCallback(
    (blocks) => actions.updateMessage(messageId, { blocks }),
    [actions, messageId]
  );

  const sendDirectMessageToAuthor = useLatestCallback(() => {
    const redirect = (c) => navigate(`/channels/${c.id}`);

    const dmChannel = selectors.selectDmChannelFromUserId(message.authorUserId);

    if (dmChannel != null) {
      redirect(dmChannel);
      return;
    }

    actions
      .createDmChannel({ memberUserIds: [message.authorUserId] })
      .then(redirect);
  });

  const remove = React.useCallback(
    () => actions.removeMessage(messageId),
    [actions, messageId]
  );

  const addReaction = React.useCallback(
    (emoji) => {
      const existingReaction = reactions.find((r) => r.emoji === emoji);

      if (!existingReaction?.users.includes(me?.id))
        addMessageReaction(messageId, { emoji });

      setEmojiPickerOpen(false);
    },
    [messageId, reactions, addMessageReaction, me?.id]
  );

  const toolbarDropdownItems = React.useMemo(
    () =>
      message.isSystemMessage || message.isAppMessage
        ? []
        : [
            {
              key: "message",
              children: [
                { key: "reply", onSelect: initReply, label: "Reply" },
                { key: "mark-unread", disabled: true, label: "Mark unread" },
                {
                  key: "edit-message",
                  onSelect: () => {
                    setEditingMessage(true);
                  },
                  label: "Edit message",
                  visible: allowEdit,
                },
                {
                  key: "delete-message",
                  onSelect: () => {
                    if (
                      confirm("Are you sure you want to remove this message?")
                    )
                      remove();
                  },
                  label: allowEdit ? "Delete message" : "Admin delete",
                  visible: allowEdit || isAdmin,
                  danger: true,
                },
              ],
            },
            {
              key: "user",
              children: [
                {
                  key: "send-message",
                  onSelect: sendDirectMessageToAuthor,
                  label: "Send direct message",
                  disabled: !allowDirectMessages,
                  visible:
                    !isOwnMessage &&
                    !(isDirectMessage && channel?.memberUserIds.length <= 2),
                },
                {
                  key: "copy-account-address",
                  onSelect: () => {
                    navigator.clipboard.writeText(message.author.walletAddress);
                  },
                  label: "Copy user wallet address",
                  visible: message.author?.walletAddress != null,
                },
              ],
            },
          ].map((section) => ({
            ...section,
            children: section.children.filter(
              (i) => i.visible == null || i.visible
            ),
          })),
    [
      allowEdit,
      allowDirectMessages,
      isAdmin,
      isDirectMessage,
      isOwnMessage,
      channel?.memberUserIds.length,
      initReply,
      message.author?.walletAddress,
      message.isSystemMessage,
      message.isAppMessage,
      remove,
      sendDirectMessageToAuthor,
    ]
  );

  React.useEffect(() => {
    if (!isEditing) return;

    editInputRef.current.focus();
    containerRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [isEditing]);

  const onEmojiPickerOpenChange = React.useCallback((isOpen) => {
    setEmojiPickerOpen(isOpen);
  }, []);

  const replyTargetMessageElement = showReplyTargetMessages &&
    message.isReply && (
      <ReplyTargetMessage
        messageId={message.replyTargetMessageId}
        layout={layout}
        onClickMessage={() => {
          scrollToMessage(message.replyTargetMessageId);
        }}
      />
    );

  const messageElement = (
    <div
      ref={containerRef}
      role="listitem"
      data-message-id={messageId}
      style={{
        "--background": hasPendingReply
          ? "var(--bg-highlight)"
          : showAsFocused
          ? "var(--bg-focus)"
          : undefined,
        "--padding":
          showSimplifiedMessage || compact
            ? `0.5rem ${horizontalPadding}`
            : `0.7rem ${horizontalPadding} 0.3rem`,
        "--color": message.isOptimistic ? "var(--color-optimistic)" : undefined,
      }}
      className="channel-message-container"
      {...(setTouchFocused == null
        ? hoverHandlers
        : {
            onClick: () => {
              setTouchFocused(messageId);
            },
          })}
      {...containerProps}
    >
      {!message.isOptimistic && (
        <div
          className="toolbar-container"
          style={{
            display: showAsFocused ? "block" : "none",
            right: horizontalPadding,
          }}
        >
          <MessageToolbar
            allowReplies={!isOwnMessage && !message.isSystemMessage}
            allowEdit={allowEdit}
            allowReactions={me != null}
            initReply={initReply}
            initEdit={initEdit}
            addReaction={addReaction}
            isEmojiPickerOpen={isEmojiPickerOpen}
            onEmojiPickerOpenChange={onEmojiPickerOpenChange}
            dropdownMenuSections={toolbarDropdownItems}
          />
        </div>
      )}

      {message.isReply &&
        layout !== "bubbles" &&
        showReplyTargetMessages &&
        replyTargetMessageElement}

      <div
        className="main-container"
        style={{
          gridTemplateColumns: showLeftColumn
            ? "var(--avatar-size) minmax(0,1fr)"
            : "minmax(0,1fr)",
          gridGap: compact
            ? "var(--gutter-size-compact)"
            : "var(--gutter-size)",
        }}
      >
        {showLeftColumn && (
          <MessageLeftColumn
            messageId={messageId}
            layout={layout}
            simplified={showSimplifiedMessage}
            isHovering={isHovering}
          />
        )}

        <div
          style={{
            display: layout === "bubbles" ? "flex" : "block",
            flexDirection: "column",
          }}
        >
          {!showSimplifiedMessage && (
            <MessageHeader messageId={messageId} layout={layout} />
          )}

          {message.isReply && layout === "bubbles" && (
            <Bubble
              small
              align={isOwnMessage ? "right" : "left"}
              css={(t) =>
                css({
                  background: t.colors.backgroundTertiary,
                  margin: "0 0 0.5rem",
                })
              }
            >
              {replyTargetMessageElement}
            </Bubble>
          )}

          {message.isSystemMessage ? (
            layout === "bubbles" ? (
              <div
                css={(t) =>
                  css({
                    color: t.colors.textDimmed,
                    fontSize: t.text.sizes.small,
                    padding: "0 0.5rem",
                  })
                }
              >
                <SystemMessageContent messageId={messageId} minimal />
              </div>
            ) : (
              <SystemMessageContent messageId={messageId} />
            )
          ) : isEditing ? (
            <EditMessageInput
              ref={editInputRef}
              blocks={message.content}
              cancel={() => {
                setEditingMessage(false);
              }}
              requestRemove={() =>
                new Promise((resolve, reject) => {
                  if (
                    !confirm("Are you sure you want to remove this message?")
                  ) {
                    resolve();
                    return;
                  }

                  remove().then(resolve, reject);
                })
              }
              save={(content) =>
                save(content).then(() => {
                  setEditingMessage(false);
                })
              }
              members={members}
            />
          ) : (
            <>
              <MessageBody messageId={messageId} layout={layout} />
              {message.embeds?.length > 0 && (
                <Embeds messageId={messageId} layout={layout} />
              )}
            </>
          )}

          {reactions.length !== 0 && (
            <Reactions
              messageId={messageId}
              addReaction={addReaction}
              hideAddButton={!isHovering && !isTouchFocused}
              layout={layout}
            />
          )}

          {threads && message.replyMessageIds?.length >= 2 && (
            <Thread
              messageId={messageId}
              layout={layout}
              initReply={initReply}
            />
          )}
        </div>
      </div>
    </div>
  );

  const createdAt = new Date(message.createdAt);

  if (
    message != null &&
    previousMessage != null &&
    getDayOfTheMonth(createdAt) !==
      getDayOfTheMonth(new Date(previousMessage.createdAt))
  )
    return (
      <>
        <div
          role="separator"
          css={(t) =>
            css({
              padding: "1.6rem",
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
              gridGap: "1rem",
              alignItems: "center",
              ".divider": { height: "0.1rem" },
              ".divider:first-of-type": {
                background: `linear-gradient(-90deg, ${t.colors.borderLighter}, transparent)`,
              },
              ".divider:last-of-type": {
                background: `linear-gradient(90deg, ${t.colors.borderLighter}, transparent)`,
              },
              ".date": {
                fontSize: t.text.sizes.small,
                fontWeight: t.text.weights.emphasis,
                color: t.colors.textMutedAlpha,
              },
            })
          }
        >
          <div className="divider" />
          <div className="date">
            {isDateToday(createdAt) ? (
              "Today"
            ) : isDateYesterday(createdAt) ? (
              "Yesterday"
            ) : (
              <FormattedDate value={createdAt} month="long" day="numeric" />
            )}
          </div>
          <div className="divider" />
        </div>
        {messageElement}
      </>
    );

  return messageElement;
});

const Thread = ({ messageId, layout, initReply }) => {
  const [isExpanded, setExpanded] = React.useState(true);
  const replyMessages = useSortedMessageReplies(messageId) ?? [];
  const lastReply = replyMessages.slice(-1)[0];
  const lastReplyAuthorUser = useUser(lastReply?.authorUserId);
  return (
    <div style={{ paddingLeft: layout === "compact" ? "2.7rem" : 0 }}>
      <button
        onClick={() => {
          setExpanded((s) => !s);
        }}
        css={(t) =>
          css({
            outline: "none",
            display: "flex",
            alignItems: "center",
            padding: "0.4rem",
            width: "calc(100% + 0.4rem)",
            position: "relative",
            left: "-0.4rem",
            marginTop: "0.2rem",
            borderRadius: "0.5rem",
            "[data-view-replies]": { display: "none" },
            "@media(hover: hover)": {
              cursor: "pointer",
              ":hover": {
                background: t.colors.backgroundModifierHover,
                // boxShadow: t.shadows.elevationLow,
                "[data-link]": {
                  color: t.colors.linkModifierHover,
                  textDecoration: "underline",
                },
                "[data-last-reply-at]": { display: "none" },
                "[data-view-replies]": { display: "inline" },
              },
            },
          })
        }
      >
        {isExpanded ? (
          <div style={{ width: "2rem", height: "2rem", position: "relative" }}>
            <div
              css={(t) =>
                css({
                  position: "absolute",
                  bottom: "-0.4rem",
                  right: 0,
                  border: "0.2rem solid",
                  borderColor: t.colors.borderLight,
                  width: "1.1rem",
                  height: "1.5rem",
                  borderRight: 0,
                  borderBottom: 0,
                  borderTopLeftRadius: "0.4rem",
                })
              }
            />
          </div>
        ) : (
          <AccountAvatar
            transparent
            address={lastReplyAuthorUser?.walletAddress}
            size="2rem"
          />
        )}
        <Link
          data-link
          component="div"
          css={(t) => css({ fontSize: t.text.sizes.small, margin: "0 0.7rem" })}
        >
          {replyMessages.length} replies
        </Link>
        <div
          css={(t) =>
            css({ color: t.colors.textDimmed, fontSize: t.text.sizes.small })
          }
        >
          <span data-last-reply-at>
            Last reply{" "}
            <FormattedDateWithTooltip
              capitalize={false}
              value={lastReply.createdAt}
            />
          </span>
          <span data-view-replies>
            {isExpanded ? "Hide replies" : "View replies"}
          </span>
        </div>
      </button>
      {isExpanded && (
        <div>
          {replyMessages.map((m, i, ms) => (
            <ChannelMessage
              key={m.id}
              messageId={m.id}
              previousMessageId={ms[i - 1]}
              layout="compact"
              showLeftColumn={false}
              showReplyTargetMessages={false}
              initReply={initReply}
              horizontalPadding={0}
              style={{ "--padding": "0.6rem 0", "--border-radius": "0.5rem" }}
            />
          ))}
          <button
            onClick={() => {
              initReply(lastReply.id);
            }}
            css={(t) =>
              css({
                outline: "none",
                padding: "0.4rem 0",
                marginTop: "0.2rem",
                width: "100%",
                display: "flex",
                alignItems: "center",
                borderRadius: "0.5rem",
                "@media(hover: hover)": {
                  cursor: "pointer",
                  ":hover": {
                    background: t.colors.backgroundModifierHover,
                    // boxShadow: t.shadows.elevationLow,
                    "[data-link]": {
                      color: t.colors.linkModifierHover,
                      textDecoration: "underline",
                    },
                  },
                },
              })
            }
          >
            <div
              style={{ width: "2rem", height: "2rem", position: "relative" }}
            >
              <div
                css={(t) =>
                  css({
                    position: "absolute",
                    top: "-0.4rem",
                    right: 0,
                    border: "0.2rem solid",
                    borderColor: t.colors.borderLight,
                    width: "1.1rem",
                    height: "1.5rem",
                    borderRight: 0,
                    borderTop: 0,
                    borderBottomLeftRadius: "0.4rem",
                  })
                }
              />
            </div>
            <Link
              data-link
              component="div"
              css={(t) =>
                css({
                  fontSize: t.text.sizes.small,
                  margin: "0 0.7rem",
                  display: "inline-flex",
                })
              }
            >
              Add reply
              <ReplyArrowIcon
                style={{ width: "1.2rem", marginLeft: "0.5rem" }}
              />
            </Link>
          </button>
        </div>
      )}
    </div>
  );
};

const MessageBody = React.memo(({ messageId, layout }) => {
  const me = useMe();
  const message = useMessage(messageId);

  const onClickInteractiveElement = React.useCallback((el) => {
    switch (el.type) {
      case "image-attachment":
        window.open(el.url, "_blank");
        break;
      default: // Ignore
    }
  }, []);

  if (message == null) return null;

  const richText = (
    <RichText
      compact={layout === "compact"}
      blocks={message.content}
      onClickInteractiveElement={onClickInteractiveElement}
      suffix={
        message.isEdited && (
          <span
            css={(t) =>
              css({
                fontSize: t.text.sizes.tiny,
                color: t.colors.textMuted,
              })
            }
          >
            {" "}
            (edited)
          </span>
        )
      }
    />
  );

  if (layout === "bubbles") {
    const isAuthorMe = me != null && message.authorUserId === me.id;
    return <Bubble align={isAuthorMe ? "right" : "left"}>{richText}</Bubble>;
  }

  return richText;
});

const Bubble = ({ align, small, maxWidth = "64rem", children, ...props }) => (
  <div
    css={(t) =>
      css({
        "--bg-regular": t.colors.backgroundTertiary,
        "--bg-me": t.colors.primaryTransparentSoft,
        background: "var(--background)",
      })
    }
    style={{
      "--background": align === "right" ? "var(--bg-me)" : "var(--bg-regular)",
      alignSelf: align === "right" ? "flex-end" : "flex-start",
      padding: small ? "0.4rem 0.6rem" : "0.7rem 1.4rem",
      borderRadius: small ? "1.35rem" : "1.9rem",
      minHeight: small ? 0 : "3.8rem",
      maxWidth: `min(calc(100% - 3.2rem), ${maxWidth})`,
    }}
    {...props}
  >
    {children}
  </div>
);

const Embeds = React.memo(({ messageId, layout }) => {
  const me = useMe();
  const message = useMessage(messageId);
  const embeds = useMessageEmbeds(messageId);
  const maxWidth = "60rem";

  return (
    <ul
      css={css({
        display: "flex",
        flexDirection: "column",
        marginTop: "0.5rem",
        "li + li": { marginTop: "1rem" },
      })}
      style={{
        maxWidth: layout === "bubbles" ? undefined : maxWidth,
      }}
    >
      {embeds.map((embed, i) => {
        const key = `${embed.url}-${i}`;

        const embedContent = <Embed key={key} {...embed} />;

        if (layout !== "bubbles") return embedContent;

        const isAuthorMe = me != null && message.authorUserId === me.id;
        return (
          <Bubble
            key={key}
            align={isAuthorMe ? "right" : "left"}
            maxWidth={maxWidth}
          >
            {embedContent}
          </Bubble>
        );
      })}
    </ul>
  );
});

const Embed = ({
  title,
  description,
  sub,
  image,
  video,
  url,
  favicon,
  hostname,
  siteName,
  metatags,
}) => (
  <li css={css({ display: "flex", alignItems: "stretch" })}>
    <div
      css={(t) =>
        css({
          width: "0.4rem",
          background: t.colors.borderLight,
          borderRadius: "0.2rem",
        })
      }
    />
    <div css={css({ flex: 1, minWidth: 0, padding: "0 1.2rem" })}>
      <div
        css={css({
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          img: {
            display: "inline-block",
            width: "1.6rem",
            height: "1.6rem",
            borderRadius: "0.2rem",
            marginRight: "0.8rem",
            verticalAlign: "middle",
            marginBottom: "0.3rem",
          },
        })}
      >
        {favicon != null && <img src={favicon} loading="lazy" />}
        {title === siteName ? hostname : siteName}
      </div>
      <div
        css={css({
          display: "flex",
          // Hide potential overflow of the embed image
          overflow: "hidden",
        })}
      >
        <div css={css({ flex: 1, minWidth: 0 })}>
          <a
            href={url}
            rel="noreferrer"
            target="_blank"
            css={(t) =>
              css({
                color: t.colors.link,
                display: "inline-block",
                verticalAlign: "middle",
                maxWidth: "100%",
                textDecoration: "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                "@media(hover: hover)": {
                  ":hover": {
                    color: t.colors.linkModifierHover,
                    textDecoration: "underline",
                  },
                },
              })
            }
          >
            {title}
          </a>
          {description != null && <div>{description}</div>}
          {sub != null && (
            <div
              css={(t) =>
                css({
                  marginTop: "0.2rem",
                  fontSize: t.fontSizes.small,
                  color: t.colors.textDimmed,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                })
              }
            >
              {sub}
            </div>
          )}
          {video != null &&
            (() => {
              const actualWidth = metatags["og:videoWidth"];
              const actualHeight = metatags["og:videoHeight"];
              const hasKnownDimensons =
                actualWidth != null && actualHeight != null;
              const maxHeight = 400;
              const aspectRatio = actualWidth / actualHeight;
              const calculatedWidth =
                actualHeight < maxHeight
                  ? actualWidth
                  : maxHeight * aspectRatio;

              return (
                <video
                  controls
                  playsInline
                  src={video}
                  poster={image}
                  width={hasKnownDimensons ? calculatedWidth : undefined}
                  css={css({
                    display: "block",
                    marginTop: "0.8rem",
                    borderRadius: "0.3rem",
                    objectFit: "cover",
                    maxWidth: "100%",
                    height: hasKnownDimensons ? "auto" : 260,
                    width: hasKnownDimensons ? calculatedWidth : "auto",
                    aspectRatio: hasKnownDimensons
                      ? `${actualWidth} / ${actualHeight}`
                      : undefined,
                  })}
                />
              );
            })()}
        </div>
        {video == null && image != null && description != null && (
          <div
            css={css({
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-end",
              marginLeft: "1rem",
              paddingTop: "1rem",
              height: 0,
              width: "8rem",
              img: {
                maxWidth: "8rem",
                maxHeight: "5.8rem",
                height: "auto",
                borderRadius: "0.3rem",
              },
            })}
          >
            <img src={image} loading="lazy" />
          </div>
        )}
      </div>
    </div>
  </li>
);

const Reactions = ({ messageId, addReaction, hideAddButton, layout }) => {
  const me = useMe();
  const message = useMessage(messageId);
  const items = useMessageReactions(messageId);

  const isAuthorMe = me != null && me.id === message.authorUserId;

  const inputDeviceCanHover = useMatchMedia("(hover: hover)");
  const [isInlineEmojiPickerOpen, setInlineEmojiPickerOpen] =
    React.useState(false);

  const align =
    layout !== "bubbles" ? undefined : isAuthorMe ? "right" : "left";

  const emojiPickerTrigger = (
    <EmojiPicker
      width="31.6rem"
      height="28.4rem"
      placement="top"
      isOpen={isInlineEmojiPickerOpen}
      onOpenChange={(open) => {
        setInlineEmojiPickerOpen(open);
      }}
      onSelect={(emoji) => {
        addReaction(emoji);
      }}
      trigger={
        <button
          data-fader
          onClick={() => {
            setInlineEmojiPickerOpen(true);
          }}
          css={(t) =>
            css({
              color: t.textNormal,
              transition: "0.1s opacity ease-out",
              outline: "none",
              svg: { width: "1.6rem", height: "auto" },
            })
          }
        >
          <EmojiFaceIcon style={{ width: "1.6rem", height: "auto" }} />
        </button>
      }
    />
  );

  const reactionList = items.map((r) => (
    <Reaction key={r.emoji} messageId={messageId} {...r} />
  ));

  return (
    <>
      <div
        css={(t) =>
          css({
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "auto",
            gridGap: "0.4rem",
            justifyContent: "flex-start",
            margin: "0.5rem -1px 0",
            ":not(:focus-within) [data-fader]": {
              opacity: "var(--fader-opacity)",
            },
            button: {
              display: "flex",
              alignItems: "center",
              height: "2.5rem",
              fontSize: "1.25rem",
              background: t.colors.backgroundModifierHover,
              borderRadius: "var(--border-radius)",
              padding: "0 0.7rem 0 0.6rem",
              lineHeight: 1,
              userSelect: "none",
              border: "1px solid transparent",
              cursor: "pointer",
              outline: "none",
              ":focus-visible, &.active:focus-visible": {
                borderColor: t.colors.textAccent,
              },
              "&.active": {
                background: "#007ab333",
                borderColor: "#007ab3a8",
              },
              "&:not(.active):hover": {
                borderColor: t.colors.borderLight,
              },
              ".count": {
                fontSize: "1rem",
                fontWeight: "400",
                color: t.colors.textNormal,
                marginLeft: "0.5rem",
              },
            },
          })
        }
        style={{
          "--fader-opacity": hideAddButton ? 0 : 1,
          "--border-radius": layout === "bubbles" ? "1.25rem" : "0.7rem",
          padding: layout === "bubbles" ? "0 0.5rem" : undefined,
          alignSelf:
            align === "left"
              ? "flex-start"
              : align === "right"
              ? "flex-end"
              : undefined,
        }}
      >
        {layout !== "bubbles" || align === "left" || !inputDeviceCanHover ? (
          <>
            {reactionList}
            {emojiPickerTrigger}
          </>
        ) : (
          <>
            {emojiPickerTrigger}
            {reactionList}
          </>
        )}
      </div>
    </>
  );
};

const Reaction = ({ messageId, emoji, count, users: userIds }) => {
  const { addMessageReaction, removeMessageReaction } = useActions();

  const emojiItem = useEmojiById(emoji);

  const hasReacted = useHasReactedWithEmoji(messageId, emoji);
  const users = useUsers(userIds);
  const authorDisplayNames = users.map((m) => m.displayName);

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          onClick={() => {
            if (hasReacted) {
              removeMessageReaction(messageId, { emoji });
              return;
            }

            addMessageReaction(messageId, { emoji });
          }}
          className={hasReacted ? "active" : undefined}
        >
          <span>
            <Emoji emoji={emoji} />
          </span>
          <span className="count">{count}</span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content
        side="top"
        sideOffset={4}
        style={{ borderRadius: "0.5rem" }}
      >
        <div
          css={css({
            display: "grid",
            gridTemplateColumns: "auto minmax(0,auto)",
            gridGap: "0.8rem",
            alignItems: "center",
            padding: "0 0.4rem 0 0.2rem",
            lineHeight: 1.4,
            maxWidth: "24rem",
          })}
        >
          <div
            css={css({
              fontSize: "2.8rem",
              lineHeight: "1.1",
              padding: "0.1rem 0 0",
            })}
          >
            <Emoji emoji={emoji} />
          </div>
          <div
            css={css({
              hyphens: "auto",
              wordBreak: "break-word",
              padding: "0.2rem 0",
            })}
          >
            {authorDisplayNames.length === 2
              ? authorDisplayNames.join(" and ")
              : [
                  authorDisplayNames.slice(0, -1).join(", "),
                  authorDisplayNames.slice(-1)[0],
                ]
                  .filter(Boolean)
                  .join(", and ")}{" "}
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              reacted
              {emojiItem != null && (
                <> with :{emojiItem.id ?? emojiItem.aliases[0]}:</>
              )}
            </span>
          </div>
        </div>
      </Tooltip.Content>
    </Tooltip.Root>
  );
};

const MessageHeader = ({ layout, messageId }) => {
  const message = useMessage(messageId);
  const authorUser = useUser(message?.authorUserId);
  const me = useMe();

  if (message.isSystemMessage) return null;

  if (message.isAppMessage) {
    const isWaitingForApp = message.app?.name == null;
    return (
      <div
        css={(t) =>
          css({
            color: t.colors.pink,
            fontWeight: t.text.weights.emphasis,
            lineHeight: 1.2,
            display: "inline-flex",
            alignItems: "center",
          })
        }
        style={{
          opacity: isWaitingForApp ? 0 : 1,
          marginRight: layout === "compact" ? "1rem" : 0,
        }}
      >
        {message.app?.name ?? "..."}
        <span
          css={(t) =>
            css({
              marginLeft: "0.5rem",
              padding: "0.2rem 0.3rem",
              lineHeight: 1,
              fontSize: t.fontSizes.tiny,
              borderRadius: "0.3rem",
              background: t.colors.backgroundModifierHover,
              color: t.colors.textDimmed,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              cursor: "default",
              fontWeight: "600",
            })
          }
        >
          app
        </span>
      </div>
    );
  }

  if (layout === "bubbles") {
    const isAuthorMe = me != null && message.authorUserId === me.id;
    return (
      <div
        style={{
          height: "2rem",
          display: "flex",
          alignItems: "flex-end",
          alignSelf: isAuthorMe ? "flex-end" : "flex-start",
          padding: "0.2rem 0",
          paddingLeft: isAuthorMe ? 0 : "1.4rem",
          paddingRight: isAuthorMe ? "1.4rem" : 0,
        }}
      >
        <AccountPreviewPopoverTrigger
          userId={message.authorUserId}
          css={(t) =>
            css({
              display: "block",
              fontSize: t.text.sizes.small,
              fontWeight: t.text.weights.normal,
              color: t.colors.textDimmed,
            })
          }
        />
      </div>
    );
  }

  if (layout === "compact")
    return (
      <AccountPreviewPopoverTrigger userId={message.authorUserId}>
        <button
          css={(t) =>
            css({
              outline: "none",
              display: "inline",
              borderRadius: "0.3rem",
              marginRight: "0.5rem",
              ":focus-visible": { boxShadow: t.shadows.focus },
              "@media(hover: hover)": {
                cursor: "pointer",
                ":hover [data-name]": {
                  textDecoration: "underline",
                },
              },
            })
          }
        >
          <AccountAvatar
            transparent
            address={message.author?.walletAddress}
            size="2rem"
            style={{
              display: "inline-flex",
              verticalAlign: "sub",
              marginRight: "0.7rem",
              transform: "translateY(0.1rem)",
            }}
          />
          <InlineUserButton
            component="span"
            variant="link"
            data-name
            userId={message.authorUserId}
          />
        </button>
      </AccountPreviewPopoverTrigger>
    );

  return (
    <div
      css={css`
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, auto);
        justify-content: flex-start;
        align-items: flex-end;
        grid-gap: 0.6rem;
        margin: 0 0 0.2rem;
        cursor: default;
        min-height: 1.9rem;
        line-height: 1.2;
      `}
    >
      {message.authorUserId != null && (
        <>
          <AccountPreviewPopoverTrigger userId={message.authorUserId} />

          <TinyMutedText style={{ lineHeight: 1.5 }}>
            <FormattedDateWithTooltip
              value={message.createdAt}
              hour="numeric"
              minute="numeric"
              day="numeric"
              month="short"
              tooltipSideOffset={8}
            />
          </TinyMutedText>
        </>
      )}

      {authorUser?.onlineStatus === "online" && (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <div css={css({ padding: "0.5rem 0.2rem" })}>
              <div
                css={(theme) =>
                  css({
                    width: "0.6rem",
                    height: "0.6rem",
                    borderRadius: "50%",
                    background: theme.colors.onlineIndicator,
                  })
                }
              />
            </div>
          </Tooltip.Trigger>
          <Tooltip.Content side="top" align="center" sideOffset={6}>
            User online
          </Tooltip.Content>
        </Tooltip.Root>
      )}
    </div>
  );
};

const MessageToolbar = React.memo(
  ({
    dropdownMenuSections = [],
    allowReplies,
    allowEdit,
    allowReactions,
    initReply,
    initEdit,
    addReaction,
    isEmojiPickerOpen,
    onEmojiPickerOpenChange,
  }) => {
    const toolbarRef = React.useRef();
    const dropdownMenuItems = dropdownMenuSections.flatMap((i) => i.children);
    return (
      <Toolbar.Root ref={toolbarRef}>
        <EmojiPicker
          width="31.6rem"
          height="28.4rem"
          isOpen={isEmojiPickerOpen}
          onOpenChange={onEmojiPickerOpenChange}
          onSelect={(emoji) => {
            addReaction(emoji);
          }}
          trigger={
            <Toolbar.Button
              aria-label="Add reaction"
              disabled={!allowReactions}
              onClick={() => {
                onEmojiPickerOpenChange(true);
              }}
              style={{ position: "relative" }}
            >
              <span>
                <EmojiFaceIcon style={{ width: "1.6rem" }} />
              </span>
            </Toolbar.Button>
          }
        />

        {allowReplies && (
          <Toolbar.Button
            onClick={() => {
              initReply();
            }}
            aria-label="Reply"
          >
            <ReplyArrowIcon css={css({ width: "1.6rem", height: "auto" })} />
          </Toolbar.Button>
        )}

        {allowEdit && (
          <Toolbar.Button
            onClick={() => {
              initEdit();
            }}
            aria-label="Edit"
          >
            <EditPenIcon style={{ width: "1.6rem", height: "auto" }} />
          </Toolbar.Button>
        )}

        {dropdownMenuSections.length > 0 && (
          <>
            <Toolbar.Separator />
            <DropdownMenu.Root placement="bottom end" targetRef={toolbarRef}>
              <DropdownMenu.Trigger>
                <Toolbar.Button>
                  <DotsHorizontalIcon
                    css={css({ width: "1.7rem", height: "auto" })}
                  />
                </Toolbar.Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                disabledKeys={dropdownMenuItems
                  .filter((i) => i.disabled)
                  .map((i) => i.key)}
                onAction={(key) => {
                  const item = dropdownMenuItems.find((i) => i.key === key);
                  item.onSelect();
                }}
                items={dropdownMenuSections}
              >
                {(section) => (
                  <DropdownMenu.Section items={section.children}>
                    {(item) => (
                      <DropdownMenu.Item danger={item.danger}>
                        {item.label}
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Section>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </>
        )}
      </Toolbar.Root>
    );
  }
);

const EditMessageInput = React.forwardRef(
  ({ blocks, save, requestRemove, cancel, ...props }, editorRef) => {
    const { uploadImage } = useActions();

    return (
      <MessageEditorForm
        ref={editorRef}
        inline
        allowEmptySubmit
        initialValue={blocks}
        placeholder="..."
        onKeyDown={(e) => {
          if (!e.isDefaultPrevented() && e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        uploadImage={uploadImage}
        submit={async (blocks) => {
          const isEmpty = messageUtils.isEmpty(blocks, { trim: true });

          if (isEmpty) {
            await requestRemove();
            return;
          }

          await save(blocks);
        }}
        containerProps={{ css: css({ padding: "0.6rem 0.8rem 0.8rem" }) }}
        renderSubmitArea={({ isPending }) => (
          <div
            css={css({
              flex: "1 1 auto",
              display: "flex",
              justifyContent: "flex-end",
            })}
          >
            <div
              css={css({
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(max-content, 1fr))",
                justifyContent: "flex-end",
                gridGap: "0.8rem",
              })}
            >
              <Button
                type="button"
                size="small"
                onClick={cancel}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="small"
                type="submit"
                isLoading={isPending}
                disabled={isPending}
              >
                Save
              </Button>
            </div>
          </div>
        )}
        {...props}
      />
    );
  }
);

const ReplyTargetMessage = ({ messageId, layout, onClickMessage }) => {
  const message = useMessage(messageId);
  const authorMember = useUser(message?.authorUserId);

  const showAvatar = authorMember != null && !authorMember?.deleted;

  return (
    <div
      css={(t) =>
        css({
          position: "relative",
          ":before": {
            display: "var(--path-display)",
            content: '""',
            position: "absolute",
            right: "calc(100% - 5rem + 0.5rem)",
            top: "calc(50% - 1px)",
            width: "2.7rem",
            height: "1.2rem",
            border: "0.2rem solid",
            borderColor: t.colors.borderLight,
            borderRight: 0,
            borderBottom: 0,
            borderTopLeftRadius: "0.4rem",
          },
        })
      }
      style={{
        "--path-display": layout === "bubbles" ? "none" : "block",
        paddingLeft: layout !== "bubbles" ? "5rem" : undefined,
        marginBottom: layout === "bubbles" ? 0 : "0.5rem",
      }}
    >
      <div
        css={css({
          display: showAvatar ? "grid" : "block",
          gridTemplateColumns: "1.4rem minmax(0,1fr)",
          alignItems: "center",
          gridGap: "0.5rem",
        })}
      >
        {showAvatar && (
          <AccountAvatar
            transparent
            address={authorMember?.walletAddress}
            size="1.4rem"
          />
        )}

        <div
          css={(t) =>
            css({
              fontSize: "1.3rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: t.colors.textDimmed,
            })
          }
        >
          {message?.deleted ? (
            <span
              css={(t) =>
                css({ fontStyle: "italic", color: t.colors.textMuted })
              }
            >
              Deleted message
            </span>
          ) : (
            <>
              <AccountPreviewPopoverTrigger userId={message?.authorUserId}>
                <span
                  role="button"
                  tabIndex={0}
                  css={(t) =>
                    css({
                      color: authorMember?.deleted
                        ? t.colors.textDimmed
                        : undefined,
                      fontWeight: "500",
                      "@media(hover: hover)": {
                        ":not(:disabled)": {
                          cursor: "pointer",
                          ":hover": {
                            textDecoration: "underline",
                          },
                        },
                      },
                    })
                  }
                >
                  {authorMember == null ? (
                    <wbr />
                  ) : authorMember.deleted ? (
                    "Deleted user"
                  ) : (
                    authorMember.displayName
                  )}
                </span>
              </AccountPreviewPopoverTrigger>
              {": "}
              <span
                role="button"
                tabIndex={0}
                onClick={onClickMessage}
                css={(theme) =>
                  css({
                    "@media(hover: hover)": {
                      cursor: "pointer",
                      ":hover": { color: theme.colors.textNormal },
                    },
                  })
                }
              >
                <RichText inline blocks={message?.content ?? []} />
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const MessageLeftColumn = ({ messageId, simplified, layout, isHovering }) => {
  const me = useMe();
  const message = useMessage(messageId);

  if (simplified)
    return (
      <div
        css={css({
          transition: "0.15s opacity",
          cursor: "default",
          transform: "translateY(0.4rem)",
        })}
        style={{ opacity: isHovering ? 1 : 0 }}
      >
        <TinyMutedText nowrap style={{ float: "right" }}>
          <FormattedDateWithTooltip
            value={new Date(message.createdAt)}
            hour="numeric"
            minute="numeric"
            tooltipSideOffset={7}
            disableRelative
            disableTooltip={!isHovering}
          />
        </TinyMutedText>
      </div>
    );

  if (message.isSystemMessage || message.isAppMessage)
    return layout === "bubbles" ? (
      <div />
    ) : isHovering ? (
      <div
        css={css({
          transition: "0.15s opacity",
          cursor: "default",
          transform: "translateY(0.4rem)",
        })}
      >
        <TinyMutedText nowrap style={{ float: "right" }}>
          <FormattedDate
            value={new Date(message.createdAt)}
            hour="numeric"
            minute="numeric"
          />
        </TinyMutedText>
      </div>
    ) : (
      <div css={css({ margin: "0 auto", transform: "translateY(0.4rem)" })}>
        <JoinArrowRightIcon
          css={(theme) =>
            css({
              width: "1.5rem",
              color: message.isAppMessage
                ? theme.colors.pink
                : theme.colors.onlineIndicator,
            })
          }
        />
      </div>
    );

  if (layout === "compact")
    return (
      <div
        css={css({
          transition: "0.15s opacity",
          cursor: "default",
          transform: "translateY(0.4rem)",
        })}
        // style={{ opacity: isHovering ? 1 : 0 }}
      >
        <TinyMutedText nowrap style={{ float: "right" }}>
          <FormattedDateWithTooltip
            value={new Date(message.createdAt)}
            hour="numeric"
            minute="numeric"
            tooltipSideOffset={7}
            disableRelative
            disableTooltip={!isHovering}
          />
        </TinyMutedText>
      </div>
    );

  const isAuthorMe = me != null && message.authorUserId === me.id;

  if (layout === "bubbles" && isAuthorMe) return <div />;

  const hasVerfifiedProfilePicture =
    message.author?.profilePicture?.isVerified ?? false;

  return (
    <div style={{ padding: layout === "bubbles" ? "2rem 0 0" : "0.2rem 0 0" }}>
      <AccountPreviewPopoverTrigger userId={message.authorUserId}>
        <button
          css={(t) =>
            css({
              "--regular-color": t.colors.borderLight,
              "--verified-color": t.colors.primary,
              display: "block",
              position: "relative",
              borderRadius: t.avatars.borderRadius,
              overflow: "hidden",
              outline: "none",
              ":focus-visible": {
                boxShadow: t.shadows.focus,
              },
              "@media (hover: hover)": {
                ":not(:disabled)": {
                  cursor: "pointer",
                  ":hover": {
                    boxShadow: "var(--hover-box-shadow)",
                  },
                },
              },
            })
          }
          style={{
            "--hover-box-shadow": hasVerfifiedProfilePicture
              ? "0 0 0 0.2rem var(--verified-color)"
              : "0 0 0 0.2rem var(--regular-color)",
          }}
        >
          <AccountAvatar
            transparent
            address={message.author?.walletAddress}
            size="3.8rem"
          />
        </button>
      </AccountPreviewPopoverTrigger>
    </div>
  );
};

const SystemMessageContent = ({ messageId }) => {
  const message = useMessage(messageId);

  switch (message.type) {
    case "user-invited": {
      const isMissingData = [message.inviter, message.author].some(
        (u) => !u?.deleted && !u?.unknown && u?.walletAddress == null
      );

      return (
        <span style={{ opacity: isMissingData ? 0 : 1 }}>
          <AccountPreviewPopoverTrigger userId={message.inviterUserId} /> added{" "}
          <AccountPreviewPopoverTrigger userId={message.authorUserId} /> to the
          topic.
        </span>
      );
    }
    case "member-joined": {
      const isMissingData =
        !message.author?.deleted &&
        !message.author?.unknown &&
        message.author?.walletAddress == null;
      return (
        <span style={{ opacity: isMissingData ? 0 : 1 }}>
          <AccountPreviewPopoverTrigger userId={message.authorUserId} /> joined
          the topic. Welcome!
        </span>
      );
    }

    case "channel-updated": {
      const updates = Object.entries(message.updates);
      if (updates.length == 0 || updates.length > 1) {
        return (
          <>
            <AccountPreviewPopoverTrigger userId={message.authorUserId} />{" "}
            updated the topic.
          </>
        );
      }

      const [field, value] = updates[0];

      // Nested switch case baby!
      switch (field) {
        case "description":
          return (
            <>
              <AccountPreviewPopoverTrigger userId={message.authorUserId} />{" "}
              {(value ?? "") === "" ? (
                "cleared the topic description."
              ) : (
                <>
                  set the topic description:{" "}
                  <RichText compact blocks={messageUtils.parseString(value)} />
                </>
              )}
            </>
          );
        case "name":
          return (
            <>
              <AccountPreviewPopoverTrigger userId={message.authorUserId} />{" "}
              {(value ?? "") === "" ? (
                <>cleared the topic {field}.</>
              ) : (
                <>
                  set the topic {field}: {value}
                </>
              )}
            </>
          );
        default:
          return (
            <>
              <AccountPreviewPopoverTrigger userId={message.authorUserId} />{" "}
              updated the topic {field}.
            </>
          );
      }
    }

    case "app-installed": {
      const isMissingData = [
        message.installer?.walletAddress,
        message.app?.name,
      ].some((n) => n == null);

      return (
        <span style={{ opacity: isMissingData ? 0 : undefined }}>
          <AccountPreviewPopoverTrigger userId={message.installerUserId} />{" "}
          installed a new app:{" "}
          <span
            css={(t) =>
              css({
                color: t.colors.pink,
                fontWeight: t.text.weights.emphasis,
              })
            }
          >
            {message.app?.name ?? "..."}
          </span>
        </span>
      );
    }

    default:
      throw new Error();
  }
};

const TinyMutedText = ({ children, nowrap = false, style }) => (
  <div
    css={(theme) =>
      css({
        color: theme.colors.textDimmed,
        fontSize: theme.fontSizes.tiny,
      })
    }
    style={{ whiteSpace: nowrap ? "nowrap" : undefined, ...style }}
  >
    {children}
  </div>
);

const FormattedDateWithTooltip = React.memo(
  ({
    value,
    tooltipSideOffset = 5,
    disableRelative,
    disableTooltip,
    capitalize = true,
    ...props
  }) => {
    const formattedDate =
      !disableRelative &&
      (isDateToday(new Date(value)) || isDateYesterday(new Date(value))) ? (
        <span>
          <span style={{ textTransform: capitalize ? "capitalize" : "none" }}>
            {isDateToday(new Date(value)) ? "today" : "yesterday"}
          </span>{" "}
          at <FormattedDate value={value} hour="numeric" minute="numeric" />
        </span>
      ) : (
        <FormattedDate value={value} {...props} />
      );

    if (disableTooltip) return formattedDate;

    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span>{formattedDate}</span>
        </Tooltip.Trigger>
        <Tooltip.Content side="top" sideOffset={tooltipSideOffset}>
          <FormattedDate
            value={value}
            weekday="long"
            hour="numeric"
            minute="numeric"
            day="numeric"
            month="long"
          />
        </Tooltip.Content>
      </Tooltip.Root>
    );
  }
);

export default ChannelMessage;
