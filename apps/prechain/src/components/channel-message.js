import getDayOfTheMonth from "date-fns/getDate";
import isDateToday from "date-fns/isToday";
import isDateYesterday from "date-fns/isYesterday";
import React from "react";
import { css } from "@emotion/react";
import { useDateFormatter } from "react-aria";
import {
  useActions,
  useMessageEmbeds,
  useMe,
  useUsers,
  useMessage,
  useUser,
  useUserWithWalletAddress,
  useChannelMembers,
  useHasReactedWithEmoji,
  useMessageReactions,
  useAccountDisplayName,
} from "@shades/common/app";
import { message as messageUtils } from "@shades/common/utils";
import {
  useHover,
  AutoAdjustingHeightTextarea as Textarea,
} from "@shades/common/react";
import Button from "@shades/ui-web/button";
import EmojiPicker from "@shades/ui-web/emoji-picker";
import {
  DotsHorizontal as DotsHorizontalIcon,
  EditPen as EditPenIcon,
  TrashCan as TrashCanIcon,
  ReplyArrow as ReplyArrowIcon,
  EmojiFace as EmojiFaceIcon,
  JoinArrowRight as JoinArrowRightIcon,
} from "@shades/ui-web/icons";
import AccountAvatar from "@shades/ui-web/account-avatar";
import InlineUserButton from "@shades/ui-web/inline-user-button";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import * as Toolbar from "@shades/ui-web/toolbar";
import * as Tooltip from "@shades/ui-web/tooltip";
import * as Popover from "@shades/ui-web/popover";
import RichText from "./rich-text.js";

const {
  // withoutAttachments,
  parseString: messageBlocksFromString,
  stringifyBlocks: stringifyMessageBlocks,
} = messageUtils;

const ONE_MINUTE_IN_MILLIS = 1000 * 60;

const ChannelMessage = React.memo(function ChannelMessage_({
  messageId,
  previousMessageId,
  hasPendingReply,
  initReply: initReply_,
  isTouchFocused,
  setTouchFocused,
  scrollToMessage,
  showLeftColumn = true,
  showReplyTargetMessages = true,
  horizontalPadding = "1.6rem",
}) {
  const editInputRef = React.useRef();
  const containerRef = React.useRef();

  const actions = useActions();

  const { addMessageReaction } = actions;

  const me = useMe();
  const message = useMessage(messageId, { replies: true });
  const previousMessage = useMessage(previousMessageId);
  const members = useChannelMembers(message?.channelId);

  const [isHovering, hoverHandlers] = useHover();
  const [isEmojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [isEditing, setEditingMessage] = React.useState(false);

  const showAsFocused = !isEditing && (isTouchFocused || isHovering);

  const allowEdit =
    !message.isSystemMessage &&
    !message.isAppMessage &&
    me?.id === message.authorUserId;

  const createdAtDate = React.useMemo(
    () => new Date(message.createdAt),
    [message.createdAt]
  );

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

  const remove = React.useCallback(
    () => actions.removeMessage(messageId),
    [actions, messageId]
  );

  const initReply = React.useCallback(
    () => initReply_(messageId),
    [messageId, initReply_]
  );

  const initEdit = React.useCallback(() => {
    setEditingMessage(true);
  }, []);

  const initDelete = React.useCallback(() => {
    if (confirm("Are you sure you want to remove this message?")) remove();
  }, [remove]);

  const addReaction = React.useCallback(
    (emoji) => {
      const existingReaction = reactions.find((r) => r.emoji === emoji);

      if (!existingReaction?.users.includes(me?.id))
        addMessageReaction(messageId, { emoji });

      setEmojiPickerOpen(false);
    },
    [messageId, reactions, addMessageReaction, me?.id]
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
        "--padding": showSimplifiedMessage
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
              initEdit();
            },
          })}
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
            allowEdit={allowEdit}
            allowReactions={me != null}
            initReply={initReply}
            initEdit={initEdit}
            initDelete={initDelete}
            addReaction={addReaction}
            isEmojiPickerOpen={isEmojiPickerOpen}
            onEmojiPickerOpenChange={onEmojiPickerOpenChange}
          />
        </div>
      )}

      {message.isReply && showReplyTargetMessages && replyTargetMessageElement}

      <div
        className="main-container"
        style={{
          gridTemplateColumns: showLeftColumn
            ? "var(--avatar-size) minmax(0,1fr)"
            : "minmax(0,1fr)",
          gridGap: "var(--gutter-size)",
        }}
      >
        {showLeftColumn && (
          <MessageLeftColumn
            messageId={messageId}
            simplified={showSimplifiedMessage}
            isHovering={isHovering}
          />
        )}

        <div style={{ display: "block", flexDirection: "column" }}>
          {!showSimplifiedMessage && <MessageHeader messageId={messageId} />}

          {message.isSystemMessage ? (
            <SystemMessageContent messageId={messageId} />
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
              <MessageBody messageId={messageId} />
              {message.embeds?.length > 0 && <Embeds messageId={messageId} />}
            </>
          )}

          {reactions.length !== 0 && (
            <Reactions
              messageId={messageId}
              addReaction={addReaction}
              hideAddButton={!isHovering && !isTouchFocused}
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

const MessageBody = React.memo(({ messageId }) => {
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

  return richText;
});

const Embeds = React.memo(({ messageId }) => {
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
      style={{ maxWidth }}
    >
      {embeds.map((embed, i) => {
        const key = `${embed.url}-${i}`;

        const embedContent = <Embed key={key} {...embed} />;

        return embedContent;
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

const Reactions = ({ messageId, addReaction, hideAddButton }) => {
  const items = useMessageReactions(messageId);

  const [isInlineEmojiPickerOpen, setInlineEmojiPickerOpen] =
    React.useState(false);

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
          "--border-radius": "0.7rem",
        }}
      >
        {items.map((r) => (
          <Reaction key={r.emoji} messageId={messageId} {...r} />
        ))}

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

const MessageHeader = ({ messageId }) => {
  const message = useMessage(messageId);

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
        style={{ opacity: isWaitingForApp ? 0 : 1 }}
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
              tooltipSideOffset={8}
            />
          </TinyMutedText>
        </>
      )}
    </div>
  );
};

const MessageToolbar = React.memo(
  ({
    dropdownMenuSections = [],
    allowEdit,
    allowReactions,
    initReply,
    initEdit,
    initDelete,
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

        <Toolbar.Button
          onClick={() => {
            initReply();
          }}
          aria-label="Reply"
        >
          <ReplyArrowIcon css={css({ width: "1.6rem", height: "auto" })} />
        </Toolbar.Button>

        {allowEdit && (
          <>
            <Toolbar.Button
              onClick={() => {
                initEdit();
              }}
              aria-label="Edit"
            >
              <EditPenIcon style={{ width: "1.6rem", height: "auto" }} />
            </Toolbar.Button>
            <Toolbar.Button
              onClick={() => {
                initDelete();
              }}
              aria-label="Delete"
            >
              <TrashCanIcon style={{ width: "1.4rem", height: "auto" }} />
            </Toolbar.Button>
          </>
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
  ({ blocks, save, requestRemove, onCancel, ...props }, editorRef) => {
    // const [pendingSlateNodes, setPendingSlateNodes] = React.useState(() =>
    //   parseMessageBlocks(withoutAttachments(blocks))
    // );
    const [pendingContent, setPendingContent] = React.useState(() =>
      stringifyMessageBlocks(blocks)
    );

    const [isSaving, setSaving] = React.useState(false);

    const allowSubmit = !isSaving;
    const isDisabled = !allowSubmit;

    const submit = async () => {
      if (!allowSubmit) return;

      const blocks = messageBlocksFromString(pendingContent);
      const isEmpty = pendingContent.trim() === "";

      // const blocks = toMessageBlocks(pendingSlateNodes);
      // const isEmpty = blocks.every(isNodeEmpty);

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
        <Textarea
          ref={editorRef}
          value={pendingContent}
          onChange={(e) => {
            setPendingContent(e.target.value);
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
          style={{
            background: "none",
            width: "100%",
            display: "block",
            border: 0,
            outline: "none",
          }}
          // disableCommands
          {...props}
        />
        {/* <MessageInput */}
        {/*   ref={editorRef} */}
        {/*   initialValue={pendingSlateNodes} */}
        {/*   onChange={(nodes) => { */}
        {/*     setPendingSlateNodes(nodes); */}
        {/*   }} */}
        {/*   placeholder={`Press "Enter" to delete message`} */}
        {/*   onKeyDown={(e) => { */}
        {/*     if (e.key === "Escape") { */}
        {/*       onCancel(); */}
        {/*       return; */}
        {/*     } */}

        {/*     if (!e.isDefaultPrevented() && !e.shiftKey && e.key === "Enter") { */}
        {/*       e.preventDefault(); */}
        {/*       submit(); */}
        {/*     } */}
        {/*   }} */}
        {/*   disabled={isDisabled} */}
        {/*   disableCommands */}
        {/*   {...props} */}
        {/* /> */}
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

const ReplyTargetMessage = ({ messageId, onClickMessage }) => {
  const message = useMessage(messageId);
  const authorMember = useUser(message?.authorUserId);

  const showAvatar = authorMember != null && !authorMember?.deleted;

  return (
    <div
      css={(t) =>
        css({
          position: "relative",
          ":before": {
            display: "block",
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
      style={{ paddingLeft: "5rem", marginBottom: "0.5rem" }}
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

const MessageLeftColumn = ({ messageId, simplified, isHovering }) => {
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
            // Tooltips are slow
            disableTooltip={!isHovering}
          />
        </TinyMutedText>
      </div>
    );

  if (message.isSystemMessage || message.isAppMessage)
    return isHovering ? (
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

  const hasVerfifiedProfilePicture =
    message.author?.profilePicture?.isVerified ?? false;

  return (
    <div style={{ padding: "0.2rem 0 0" }}>
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
          <InlineUserButton userId={message.inviterUserId} /> added{" "}
          <InlineUserButton userId={message.authorUserId} /> to the channel.
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
          <InlineUserButton userId={message.authorUserId} /> joined the channel.
          Welcome!
        </span>
      );
    }

    case "channel-updated": {
      const updates = Object.entries(message.updates);
      if (updates.length == 0 || updates.length > 1) {
        return (
          <>
            <InlineUserButton userId={message.authorUserId} /> updated the
            channel.
          </>
        );
      }

      const [field, value] = updates[0];

      // Nested switch case baby!
      switch (field) {
        case "description":
          return (
            <>
              <InlineUserButton userId={message.authorUserId} />{" "}
              {(value ?? "") === "" ? (
                "cleared the topic description."
              ) : (
                <>
                  set the channel description:{" "}
                  <RichText compact blocks={messageUtils.parseString(value)} />
                </>
              )}
            </>
          );
        case "name":
          return (
            <>
              <InlineUserButton userId={message.authorUserId} />{" "}
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
              <InlineUserButton userId={message.authorUserId} /> updated the
              topic {field}.
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
          <InlineUserButton userId={message.installerUserId} /> installed a new
          app:{" "}
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

// ==========================================================================

const FormattedDate = ({ value, ...options }) => {
  const formatter = useDateFormatter(options);
  return formatter.format(typeof value === "string" ? new Date(value) : value);
};

const ProfilePreview = ({ userId }) => {
  const user = useUser(userId);
  const { displayName } = useAccountDisplayName(user?.walletAddress);
  return <div css={css({ padding: "1rem" })}>{displayName}</div>;
};

const InlineUserButtonWithProfilePopover = React.forwardRef(
  (
    { walletAddress, userId: userId_, user: user_, popoverProps, ...props },
    ref
  ) => {
    const walletUser = useUserWithWalletAddress(walletAddress);

    const userId = userId_ ?? user_?.id ?? walletUser?.id;

    const user = useUser(userId);

    if (userId == null && walletAddress == null) return null;

    const disabled = user?.deleted || user?.unknown;

    return (
      <Popover.Root placement="top" {...popoverProps}>
        <Popover.Trigger asChild disabled={disabled} {...props}>
          <InlineUserButton
            ref={ref}
            userId={userId}
            walletAddress={walletAddress}
            variant="link"
          />
        </Popover.Trigger>
        <Popover.Content>
          <ProfilePreview userId={userId} walletAddress={walletAddress} />
        </Popover.Content>
      </Popover.Root>
    );
  }
);

export default ChannelMessage;
