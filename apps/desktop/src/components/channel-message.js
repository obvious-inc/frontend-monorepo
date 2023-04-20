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
  useEmojis,
  useMessageReactions,
  useSortedMessageReplies,
} from "@shades/common/app";
import {
  array as arrayUtils,
  message as messageUtils,
  emoji as emojiUtils,
} from "@shades/common/utils";
import { useLatestCallback, useHover } from "@shades/common/react";
import Button from "@shades/ui-web/button";
import Dialog from "@shades/ui-web/dialog";
import {
  DotsHorizontal as DotsHorizontalIcon,
  EditPen as EditPenIcon,
  ReplyArrow as ReplyArrowIcon,
  EmojiFace as EmojiFaceIcon,
  AddEmojiReaction as AddEmojiReactionIcon,
  JoinArrowRight as JoinArrowRightIcon,
} from "@shades/ui-web/icons";
import {
  isNodeEmpty,
  parseMessageBlocks,
  toMessageBlocks,
} from "../slate/utils";
import useGlobalMediaQueries from "../hooks/global-media-queries";
import FormattedDate from "./formatted-date";
import MessageInput from "./message-input";
import RichText from "./rich-text";
import Input from "./input";
import Link from "./link";
import UserAvatar from "./user-avatar";
import InlineUserButton from "./inline-user-button";
import * as Popover from "./popover";
import * as DropdownMenu from "./dropdown-menu";
import * as Toolbar from "./toolbar";
import * as Tooltip from "./tooltip";
import ProfilePreview from "./profile-preview";
import InlineUserButtonWithProfilePopover from "./inline-user-button-with-profile-popover";

const { groupBy } = arrayUtils;
const { withoutAttachments } = messageUtils;
const { search: searchEmoji } = emojiUtils;

const ONE_MINUTE_IN_MILLIS = 1000 * 60;

const AVATAR_SIZE = "3.8rem";
const GUTTER_SIZE = "1.2rem";
const COMPACT_GUTTER_SIZE = "1rem";

const ChannelMessage = React.memo(function ChannelMessage_({
  messageId,
  channelId,
  previousMessageId,
  hasPendingReply,
  initReply: initReply_,
  isAdmin,
  hasTouchFocus,
  giveTouchFocus,
  layout,
  scrollToMessage,
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

  const channel = useChannel(channelId);
  const message = useMessage(messageId, { replies: true });
  const previousMessage = useMessage(previousMessageId);
  const members = useChannelMembers(channelId);

  const [isHovering, hoverHandlers] = useHover();
  const [isDropdownOpen, setDropdownOpen] = React.useState(false);
  const [isEmojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [isEditing, setEditingMessage] = React.useState(false);

  const me = useMe();

  const compact = layout === "compact";

  const showAsFocused =
    !isEditing &&
    (hasTouchFocus || isHovering || isDropdownOpen || isEmojiPickerOpen);

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
            { onSelect: initReply, label: "Reply" },
            { disabled: true, label: "Mark unread" },
            {
              onSelect: () => {
                setEditingMessage(true);
              },
              label: "Edit message",
              visible: allowEdit,
            },
            {
              onSelect: () => {
                if (confirm("Are you sure you want to remove this message?"))
                  remove();
              },
              label: allowEdit ? "Delete message" : "Admin delete",
              visible: allowEdit || isAdmin,
              style: { color: "#ff5968" },
            },
            { type: "separator" },
            {
              onSelect: sendDirectMessageToAuthor,
              label: "Send direct message",
              disabled: !allowDirectMessages,
              visible:
                !isOwnMessage &&
                !(isDirectMessage && channel?.memberUserIds.length <= 2),
            },
            {
              onSelect: () => {
                navigator.clipboard.writeText(message.author.walletAddress);
              },
              label: "Copy user wallet address",
              visible: message.author?.walletAddress != null,
            },
          ].filter((i) => i.visible == null || i.visible),
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

  const onDropdownOpenChange = React.useCallback((isOpen) => {
    setDropdownOpen(isOpen);
  }, []);

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

  return (
    <div
      ref={containerRef}
      role="listitem"
      data-message-id={messageId}
      style={{
        "--background": hasPendingReply
          ? "var(--bg-highlight)"
          : showAsFocused
          ? "var(--bg-focus)"
          : "transparent",
        "--padding":
          showSimplifiedMessage || compact
            ? `0.5rem ${horizontalPadding}`
            : `0.7rem ${horizontalPadding} 0.3rem`,
        "--color": message.isOptimistic
          ? "var(--color-optimistic)"
          : "var(--color-regular)",
      }}
      className="channel-message-container"
      {...(giveTouchFocus == null
        ? hoverHandlers
        : {
            onClick: () => {
              giveTouchFocus(messageId);
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
            onDropdownOpenChange={onDropdownOpenChange}
            isEmojiPickerOpen={isEmojiPickerOpen}
            onEmojiPickerOpenChange={onEmojiPickerOpenChange}
            dropdownItems={toolbarDropdownItems}
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
            ? `${AVATAR_SIZE} minmax(0,1fr)`
            : "minmax(0,1fr)",
          gridGap: compact ? COMPACT_GUTTER_SIZE : GUTTER_SIZE,
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
              onCancel={() => {
                setEditingMessage(false);
              }}
              requestRemove={() =>
                new Promise((resolve, reject) => {
                  if (
                    !confirm("Are you sure you want to remove this message?")
                  ) {
                    reject(new Error());
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
              hideAddButton={!isHovering && !hasTouchFocus}
              layout={layout}
            />
          )}

          {layout !== "bubbles" && message.replyMessageIds?.length >= 2 && (
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
          <UserAvatar
            transparent
            walletAddress={lastReplyAuthorUser?.walletAddress}
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
              css={css({ padding: "0.6rem 0", borderRadius: "0.5rem" })}
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
      default:
        throw new Error();
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

  const { inputDeviceCanHover } = useGlobalMediaQueries();
  const [isInlineEmojiPickerOpen, setInlineEmojiPickerOpen] =
    React.useState(false);

  const align =
    layout !== "bubbles" ? undefined : isAuthorMe ? "right" : "left";

  const addReactionButton = (
    <button
      data-fader
      onClick={() => setInlineEmojiPickerOpen(true)}
      css={(t) =>
        css({
          color: t.textNormal,
          transition: "0.1s opacity ease-out",
          outline: "none",
          svg: { width: "1.6rem", height: "auto" },
        })
      }
    >
      {/* <AddEmojiReactionIcon /> */}
      <EmojiFaceIcon style={{ width: "1.6rem", height: "auto" }} />
    </button>
  );

  const addReactionDialogTrigger = inputDeviceCanHover ? (
    <Popover.Root
      placement="top"
      isOpen={isInlineEmojiPickerOpen}
      onOpenChange={(s) => {
        setInlineEmojiPickerOpen(s);
      }}
    >
      <Popover.Trigger asChild>{addReactionButton}</Popover.Trigger>
      <Popover.Content>
        {/* <Popover.Arrow /> */}
        <EmojiPicker
          width="31.6rem"
          height="28.4rem"
          onSelect={(emoji) => {
            setInlineEmojiPickerOpen(false);
            return addReaction(emoji);
          }}
        />
      </Popover.Content>
    </Popover.Root>
  ) : (
    <>
      {addReactionButton}
      <EmojiPickerMobileDialog
        isOpen={isInlineEmojiPickerOpen}
        onRequestClose={() => setInlineEmojiPickerOpen(false)}
        onSelect={(...args) => {
          setInlineEmojiPickerOpen(false);
          return addReaction(...args);
        }}
      />
    </>
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
              fontSize: "1.5rem",
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
            {addReactionDialogTrigger}
          </>
        ) : (
          <>
            {addReactionDialogTrigger}
            {reactionList}
          </>
        )}
      </div>
    </>
  );
};

const Reaction = ({ messageId, emoji, count, users: userIds }) => {
  const { addMessageReaction, removeMessageReaction } = useActions();

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
          <span>{emoji}</span>
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
            {emoji}
          </div>
          <div
            css={css({
              hyphens: "auto",
              wordBreak: "break-word",
              padding: "0.2rem 0",
            })}
          >
            {[
              authorDisplayNames.slice(0, -1).join(", "),
              authorDisplayNames.slice(-1)[0],
            ]
              .filter(Boolean)
              .join(" and ")}{" "}
            reacted
          </div>
        </div>
      </Tooltip.Content>
    </Tooltip.Root>
  );
};

const EmojiPickerMobileDialog = ({ onSelect, isOpen, onRequestClose }) => (
  <Dialog
    isOpen={isOpen}
    onRequestClose={onRequestClose}
    css={css({ background: "none" })}
  >
    <button
      onClick={onRequestClose}
      css={css({
        padding: "0.8rem",
        display: "block",
        margin: "0 auto",
      })}
    >
      <div
        css={(t) =>
          css({
            height: "0.4rem",
            width: "4.2rem",
            borderRadius: "0.2rem",
            background: t.light
              ? t.colors.backgroundTertiary
              : t.colors.textMuted,
            boxShadow: t.shadows.elevationLow,
          })
        }
      />
    </button>
    <div
      css={(t) =>
        css({
          flex: 1,
          minHeight: 0,
          padding: "0.4rem 0.4rem 0",
          background: t.colors.popoverBackground,
          borderTopLeftRadius: "0.6rem",
          borderTopRightRadius: "0.6rem",
          boxShadow: t.shadows.elevationHigh,
        })
      }
    >
      <EmojiPicker height="100%" onSelect={onSelect} />
    </div>
  </Dialog>
);

const AppDisplayName = React.forwardRef(
  ({ displayName, color, ...props }, ref) => (
    <div
      ref={ref}
      css={(t) =>
        css({
          "--default-color": t.colors.pink,
          fontWeight: t.text.weights.emphasis,
          lineHeight: 1.2,
          display: "inline-flex",
          alignItems: "center",
        })
      }
      style={{ color: color ?? "var(--default-color)" }}
      {...props}
    >
      {displayName}
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
  )
);

const InlineAppDisplayName = React.forwardRef(
  ({ displayName, color, ...props }, ref) => (
    <span
      ref={ref}
      css={(t) =>
        css({
          "--default-color": t.colors.pink,
          fontWeight: t.text.weights.emphasis,
        })
      }
      style={{ color: color ?? "var(--default-color)" }}
      {...props}
    >
      {displayName}
    </span>
  )
);

const MessageHeader = ({ layout, messageId }) => {
  const message = useMessage(messageId);
  const authorUser = useUser(message?.authorUserId);
  const me = useMe();

  if (message.isSystemMessage) return null;

  if (message.isAppMessage) {
    const isWaitingForApp = message.app?.name == null;
    return (
      <span
        style={{
          opacity: isWaitingForApp ? 0 : 1,
          marginRight: layout === "compact" ? "1rem" : 0,
        }}
      >
        <AppDisplayName displayName={message.app?.name ?? "..."} />
      </span>
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
        <InlineUserButtonWithProfilePopover
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
      <Popover.Root placement="right">
        <Popover.Trigger
          asChild
          disabled={message.author == null || message.author.deleted}
        >
          <div
            css={css({
              display: "inline",
              cursor: "pointer",
              "@media(hover: hover)": {
                ":hover [data-name]": {
                  textDecoration: "underline",
                },
              },
            })}
          >
            <UserAvatar
              transparent
              walletAddress={message.author?.walletAddress}
              size="2rem"
              style={{
                display: "inline-flex",
                verticalAlign: "sub",
                marginRight: "0.7rem",
                transform: "translateY(0.1rem)",
              }}
            />
            <InlineUserButton
              variant="link"
              data-name
              userId={message.authorUserId}
              style={{ marginRight: "1rem" }}
            />
          </div>
        </Popover.Trigger>
        <Popover.Content>
          <ProfilePreview userId={message.authorUserId} />
        </Popover.Content>
      </Popover.Root>
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
          <InlineUserButtonWithProfilePopover userId={message.authorUserId} />

          <TinyMutedText style={{ lineHeight: 1.5 }}>
            <FormattedDateWithTooltip
              value={message.createdAt}
              hour="numeric"
              minute="numeric"
              day="numeric"
              month="short"
              tooltipContentProps={{ sideOffset: 8 }}
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

// Super hacky and inaccessible
const EmojiPicker = ({ width = "auto", height = "100%", onSelect }) => {
  const inputRef = React.useRef();

  const { allEntries: emojis, recentlyUsedEntries: recentEmojis } = useEmojis();

  const emojiByCategoryEntries = React.useMemo(
    () => Object.entries(groupBy((e) => e.category, emojis)),
    [emojis]
  );

  const [highlightedEntry, setHighlightedEntry] = React.useState(null);
  const deferredHighlightedEntry = React.useDeferredValue(highlightedEntry);

  const [query, setQuery] = React.useState("");
  const trimmedQuery = React.useDeferredValue(query.trim().toLowerCase());

  const filteredEmojisByCategoryEntries = React.useMemo(() => {
    if (trimmedQuery.length === 0) {
      if (recentEmojis.length === 0) return emojiByCategoryEntries;
      return [
        ["Recently used", recentEmojis.slice(0, 4 * 9)],
        ...emojiByCategoryEntries,
      ];
    }

    const emoji = emojiByCategoryEntries.flatMap((entry) => entry[1]);
    return [[undefined, searchEmoji(emoji, trimmedQuery)]];
  }, [emojiByCategoryEntries, recentEmojis, trimmedQuery]);

  const highlightedEmojiItem = React.useMemo(
    () =>
      deferredHighlightedEntry == null
        ? null
        : filteredEmojisByCategoryEntries[deferredHighlightedEntry[0]][1][
            deferredHighlightedEntry[1]
          ],
    [deferredHighlightedEntry, filteredEmojisByCategoryEntries]
  );

  const ROW_LENGTH = 9;

  const addReactionAtEntry = ([ci, ei]) => {
    const { emoji } = filteredEmojisByCategoryEntries[ci][1][ei];
    onSelect(emoji);
  };

  const navigationBlockedRef = React.useRef();

  // Hack to make the UI not freeze when you navigate by pressing and holding e.g. arrow down
  const wrapNavigationKeydownHandler = (handler) => {
    if (navigationBlockedRef.current) return;
    navigationBlockedRef.current = true;
    handler();
    requestAnimationFrame(() => {
      navigationBlockedRef.current = false;
    });
  };

  const handleKeyDown = (event) => {
    switch (event.key) {
      case "ArrowUp": {
        wrapNavigationKeydownHandler(() => {
          setHighlightedEntry((e) => {
            if (e == null) return null;
            const [ci, ei] = e;
            if (ei - ROW_LENGTH >= 0) return [ci, ei - ROW_LENGTH];
            if (ci === 0) return null;
            const targetColumn = ei;
            const previousCategoryItems =
              filteredEmojisByCategoryEntries[ci - 1][1];
            const lastRowLength =
              previousCategoryItems.length % ROW_LENGTH === 0
                ? ROW_LENGTH
                : previousCategoryItems.length % ROW_LENGTH;
            return [
              ci - 1,
              lastRowLength - 1 >= targetColumn
                ? previousCategoryItems.length - lastRowLength + targetColumn
                : previousCategoryItems.length - 1,
            ];
          });
          event.preventDefault();
        });
        break;
      }
      case "ArrowDown": {
        wrapNavigationKeydownHandler(() => {
          setHighlightedEntry((e) => {
            if (filteredEmojisByCategoryEntries.length === 0) return null;
            if (e == null) return [0, 0];
            const [ci, ei] = e;
            const categoryItems = filteredEmojisByCategoryEntries[ci][1];
            if (ei + ROW_LENGTH <= categoryItems.length - 1)
              return [ci, ei + ROW_LENGTH];
            const lastRowStartIndex =
              categoryItems.length % ROW_LENGTH === 0
                ? categoryItems.length - ROW_LENGTH
                : categoryItems.length - (categoryItems.length % ROW_LENGTH);

            if (ei < lastRowStartIndex) return [ci, categoryItems.length - 1];
            if (ci === filteredEmojisByCategoryEntries.length - 1)
              return [ci, ei];
            const targetColumn = ei % ROW_LENGTH;
            const nextCategoryItems =
              filteredEmojisByCategoryEntries[ci + 1][1];
            return [
              ci + 1,
              nextCategoryItems.length - 1 >= targetColumn
                ? targetColumn
                : nextCategoryItems.length - 1,
            ];
          });
          event.preventDefault();
        });
        break;
      }
      case "ArrowLeft": {
        wrapNavigationKeydownHandler(() => {
          setHighlightedEntry((e) => {
            if (e == null) return null;
            const [ci, ei] = e;
            if (ei - 1 >= 0) return [ci, ei - 1];
            if (ci === 0) {
              const categoryItems = filteredEmojisByCategoryEntries[ci][1];
              return [
                ci,
                categoryItems.length >= ROW_LENGTH
                  ? ROW_LENGTH - 1
                  : categoryItems.length - 1,
              ];
            }
            const previousCategoryItems =
              filteredEmojisByCategoryEntries[ci - 1][1];
            return [ci - 1, previousCategoryItems.length - 1];
          });
          event.preventDefault();
        });
        break;
      }
      case "ArrowRight": {
        wrapNavigationKeydownHandler(() => {
          setHighlightedEntry((e) => {
            if (e == null) return null;
            const [ci, ei] = e;
            const categoryItems = filteredEmojisByCategoryEntries[ci][1];
            if (ei + 1 <= categoryItems.length - 1) return [ci, ei + 1];
            if (ci === filteredEmojisByCategoryEntries.length - 1)
              return [ci, ei];
            return [ci + 1, 0];
          });
          event.preventDefault();
        });
        break;
      }
      case "Enter": {
        addReactionAtEntry(highlightedEntry);
        event.preventDefault();
        break;
      }
    }
  };

  React.useEffect(() => {
    inputRef.current.focus();
  }, []);

  return (
    <div
      css={css({ display: "flex", flexDirection: "column" })}
      style={{ height, width }}
    >
      <div css={css({ padding: "0.7rem 0.7rem 0.3rem" })}>
        <Input
          contrast
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedEntry(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            highlightedEmojiItem == null
              ? "Search"
              : highlightedEmojiItem.description ?? "Search"
          }
        />
      </div>

      <div
        css={(t) =>
          css({
            position: "relative",
            flex: 1,
            overflow: "auto",
            scrollPaddingTop: "3rem",
            scrollPaddingBottom: "0.5rem",
            ".category-title": {
              position: "sticky",
              top: 0,
              zIndex: 1,
              background: `linear-gradient(-180deg, ${t.colors.popoverBackground} 50%, transparent)`,
              padding: "0.6rem 0.9rem",
              fontSize: "1.2rem",
              fontWeight: "500",
              color: t.colors.textDimmed,
              textTransform: "uppercase",
              pointerEvents: "none",
            },
            ".category-container": {
              display: "grid",
              justifyContent: "space-between",
              padding: "0 0.5rem",
              gridTemplateColumns: "repeat(auto-fill, minmax(3.4rem, 1fr))",
            },
            ".emoji": {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.2rem",
              width: "3.4rem",
              height: "2.9rem",
              background: "none",
              borderRadius: "0.5rem",
              border: 0,
              cursor: "pointer",
              outline: "none",
              "&[data-selected]": {
                background: t.colors.backgroundModifierHover,
              },
              "&:focus": {
                position: "relative",
                zIndex: 2,
                boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
              },
            },
          })
        }
      >
        {filteredEmojisByCategoryEntries.map(([category, emojis], ci) => (
          <div key={category ?? "no-category"}>
            {category != null && (
              <div className="category-title">{category}</div>
            )}

            <div
              className="category-container"
              style={{ paddingTop: category == null ? "0.8rem" : undefined }}
            >
              {emojis.map(({ emoji }, i) => {
                const isHighlighted =
                  highlightedEntry != null &&
                  highlightedEntry[0] === ci &&
                  highlightedEntry[1] === i;
                return (
                  <button
                    key={emoji}
                    ref={(el) => {
                      if (el == null) return;
                      if (isHighlighted)
                        el.scrollIntoView({ block: "nearest" });
                    }}
                    className="emoji"
                    data-selected={isHighlighted ? "true" : undefined}
                    onClick={() => {
                      onSelect(emoji);
                    }}
                    onPointerMove={() => {
                      if (
                        highlightedEntry != null &&
                        highlightedEntry[0] === ci &&
                        highlightedEntry[1] === i
                      )
                        return;

                      setHighlightedEntry([ci, i]);
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MessageToolbar = React.memo(
  ({
    dropdownItems = [],
    allowReplies,
    allowEdit,
    allowReactions,
    initReply,
    initEdit,
    addReaction,
    onDropdownOpenChange,
    isEmojiPickerOpen,
    onEmojiPickerOpenChange,
  }) => {
    const { inputDeviceCanHover } = useGlobalMediaQueries();
    return (
      <Toolbar.Root>
        {inputDeviceCanHover ? (
          <Popover.Root
            placement="left"
            isOpen={isEmojiPickerOpen}
            onOpenChange={onEmojiPickerOpenChange}
          >
            <Toolbar.Button
              asChild
              aria-label="Add reaction"
              disabled={!allowReactions}
              style={{ position: "relative" }}
            >
              <Popover.Trigger>
                <span>
                  {/* <AddEmojiReactionIcon style={{ width: "1.6rem" }} /> */}
                  <EmojiFaceIcon style={{ width: "1.6rem" }} />
                </span>
              </Popover.Trigger>
            </Toolbar.Button>
            <Popover.Content>
              {/* <Popover.Arrow offset={13} /> */}
              <EmojiPicker
                onSelect={addReaction}
                width="31.6rem"
                height="28.4rem"
              />
            </Popover.Content>
          </Popover.Root>
        ) : (
          <>
            <Toolbar.Button
              asChild
              aria-label="Add reaction"
              style={{ position: "relative" }}
            >
              <button
                onClick={() => {
                  onEmojiPickerOpenChange(true);
                }}
              >
                <AddEmojiReactionIcon style={{ width: "1.6rem" }} />
              </button>
            </Toolbar.Button>
            <EmojiPickerMobileDialog
              isOpen={isEmojiPickerOpen}
              onRequestClose={() => onEmojiPickerOpenChange(false)}
              onSelect={(emoji) => {
                onEmojiPickerOpenChange(false);
                return addReaction(emoji);
              }}
            />
          </>
        )}

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

        {dropdownItems.length > 0 && (
          <>
            <Toolbar.Separator />
            <DropdownMenu.Root
              modal={false}
              onOpenChange={onDropdownOpenChange}
            >
              <Toolbar.Button asChild>
                <DropdownMenu.Trigger>
                  <DotsHorizontalIcon
                    css={css({ width: "1.7rem", height: "auto" })}
                  />
                </DropdownMenu.Trigger>
              </Toolbar.Button>
              <DropdownMenu.Content>
                {dropdownItems.map(
                  ({ onSelect, label, type, disabled, style }, i) => {
                    if (type === "separator")
                      return <DropdownMenu.Separator key={i} />;
                    return (
                      <DropdownMenu.Item
                        key={i}
                        onSelect={onSelect}
                        disabled={disabled}
                        style={style}
                      >
                        {label}
                      </DropdownMenu.Item>
                    );
                  }
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
  ({ blocks, save, requestRemove, onCancel, ...props }, editorRef) => {
    const [pendingSlateNodes, setPendingSlateNodes] = React.useState(() =>
      parseMessageBlocks(withoutAttachments(blocks))
    );

    const [isSaving, setSaving] = React.useState(false);

    const allowSubmit = !isSaving;
    const isDisabled = !allowSubmit;

    const submit = async () => {
      if (!allowSubmit) return;

      const blocks = toMessageBlocks(pendingSlateNodes);

      const isEmpty = blocks.every(isNodeEmpty);

      setSaving(true);
      try {
        if (isEmpty) {
          await requestRemove();
          return;
        }

        await save(blocks);
      } catch (e) {
        console.error(e);
        setSaving(false);
      }
    };

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        css={(theme) =>
          css({
            position: "relative",
            background: theme.colors.inputBackground,
            padding: "0.6rem 0.8rem 0.8rem",
            borderRadius: "0.7rem",
            // Prevents iOS zooming in on input fields
            "@supports (-webkit-touch-callout: none)": {
              "[role=textbox]": { fontSize: "1.6rem" },
            },
          })
        }
      >
        <MessageInput
          ref={editorRef}
          initialValue={pendingSlateNodes}
          onChange={(nodes) => {
            setPendingSlateNodes(nodes);
          }}
          placeholder={`Press "Enter" to delete message`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onCancel();
              return;
            }

            if (!e.isDefaultPrevented() && !e.shiftKey && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          disabled={isDisabled}
          disableCommands
          {...props}
        />
        <div css={css({ display: "flex", justifyContent: "flex-end" })}>
          <div
            css={css({
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(max-content, 1fr))",
              justifyContent: "flex-end",
              gridGap: "0.8rem",
              padding: "0.5rem 0 0",
            })}
          >
            <Button size="small" onClick={onCancel} disabled={!allowSubmit}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              type="submit"
              disabled={!allowSubmit}
            >
              Save
            </Button>
          </div>
        </div>
      </form>
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
          <UserAvatar
            transparent
            walletAddress={authorMember?.walletAddress}
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
              css={(theme) =>
                css({ fontStyle: "italic", color: theme.colors.textMuted })
              }
            >
              Deleted message
            </span>
          ) : (
            <>
              <Popover.Root placement="top">
                <Popover.Trigger
                  asChild
                  disabled={authorMember == null || authorMember.deleted}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    css={(t) =>
                      css({
                        color: authorMember?.deleted
                          ? t.colors.textDimmed
                          : undefined,
                        fontWeight: "500",
                        ":not([disabled])": {
                          cursor: "pointer",
                          ":hover": {
                            textDecoration: "underline",
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
                </Popover.Trigger>
                <Popover.Content>
                  <ProfilePreview userId={message?.authorUserId} />
                </Popover.Content>
              </Popover.Root>
              {": "}
              <span
                role="button"
                tabIndex={0}
                onClick={onClickMessage}
                css={(theme) =>
                  css({
                    cursor: "pointer",
                    ":hover": { color: theme.colors.textNormal },
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
            tooltipContentProps={{ sideOffset: 7 }}
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
            tooltipContentProps={{ sideOffset: 7 }}
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
    <div
      style={{
        padding: layout === "bubbles" ? "2rem 0 0" : "0.2rem 0 0",
      }}
    >
      <Popover.Root placement="top">
        <Popover.Trigger
          asChild
          disabled={message.author == null || message.author.deleted}
        >
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
                ":not([disabled])": {
                  ":active": {
                    transform: "translateY(0.1rem)",
                  },
                  "@media (hover: hover)": {
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
            <UserAvatar
              transparent
              walletAddress={message.author?.walletAddress}
              size="3.8rem"
            />
          </button>
        </Popover.Trigger>
        <Popover.Content>
          <ProfilePreview userId={message.authorUserId} />
        </Popover.Content>
      </Popover.Root>
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
          <InlineUserButtonWithProfilePopover userId={message.inviterUserId} />{" "}
          added{" "}
          <InlineUserButtonWithProfilePopover userId={message.authorUserId} />{" "}
          to the channel.
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
          <InlineUserButtonWithProfilePopover userId={message.authorUserId} />{" "}
          joined the channel. Welcome!
        </span>
      );
    }

    case "channel-updated": {
      const updates = Object.entries(message.updates);
      if (updates.length == 0 || updates.length > 1) {
        return (
          <>
            <InlineUserButtonWithProfilePopover userId={message.authorUserId} />{" "}
            updated the channel.
          </>
        );
      }

      let [field, value] = updates[0];

      // Nested switch case baby!
      switch (field) {
        case "description":
          return (
            <>
              <InlineUserButtonWithProfilePopover
                userId={message.authorUserId}
              />{" "}
              {(value ?? "") === "" ? (
                "cleared the channel topic."
              ) : (
                <>set the channel topic: {value}</>
              )}
            </>
          );
        case "name":
          return (
            <>
              <InlineUserButtonWithProfilePopover
                userId={message.authorUserId}
              />{" "}
              {(value ?? "") === "" ? (
                <>cleared the channel {field}.</>
              ) : (
                <>
                  set the channel {field}: {value}
                </>
              )}
            </>
          );
        default:
          return (
            <>
              <InlineUserButtonWithProfilePopover
                userId={message.authorUserId}
              />{" "}
              updated the channel {field}.
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
          <InlineUserButtonWithProfilePopover
            userId={message.installerUserId}
          />{" "}
          installed a new app:{" "}
          <InlineAppDisplayName displayName={message.app?.name ?? "..."} />
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
    tooltipContentProps,
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
        <Tooltip.Content side="top" sideOffset={5} {...tooltipContentProps}>
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
