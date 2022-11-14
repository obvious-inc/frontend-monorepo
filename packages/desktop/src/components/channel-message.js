import isDateToday from "date-fns/isToday";
import React from "react";
import { useNavigate } from "react-router-dom";
import { FormattedDate, FormattedRelativeTime } from "react-intl";
import { css, useTheme } from "@emotion/react";
import { useAppScope } from "@shades/common/app";
import {
  array as arrayUtils,
  object as objectUtils,
  message as messageUtils,
} from "@shades/common/utils";
import { isNodeEmpty, normalizeNodes, cleanNodes } from "../slate/utils";
import useHover from "../hooks/hover";
import useGlobalMediaQueries from "../hooks/global-media-queries";
import {
  DotsHorizontal as DotsHorizontalIcon,
  EditPen as EditPenIcon,
  ReplyArrow as ReplyArrowIcon,
} from "./icons";
import MessageInput from "./message-input";
import RichText from "./rich-text";
import Button from "./button";
import Input from "./input";
import Avatar from "./avatar";
import * as Popover from "./popover";
import * as DropdownMenu from "./dropdown-menu";
import * as Toolbar from "./toolbar";
import * as Tooltip from "./tooltip";
import Dialog from "./dialog";
import {
  AddEmojiReaction as AddEmojiReactionIcon,
  JoinArrowRight as JoinArrowRightIcon,
} from "./icons";
import ProfilePreview from "./profile-preview";

const { groupBy } = arrayUtils;
const { mapValues } = objectUtils;
const { withoutAttachments } = messageUtils;

const ONE_MINUTE_IN_MILLIS = 1000 * 60;

const AVATAR_SIZE = "3.8rem";
const GUTTER_SIZE = "1.2rem";
const COMPACT_GUTTER_SIZE = "1rem";

const ChannelMessage = React.memo(function ChannelMessage_({
  message,
  channel,
  previousMessage,
  hasPendingReply,
  initReply: initReply_,
  members,
  getMember,
  isAdmin,
  hasTouchFocus,
  giveTouchFocus,
  compact,
}) {
  const editInputRef = React.useRef();
  const containerRef = React.useRef();

  const { actions, state } = useAppScope();
  const navigate = useNavigate();

  const [isHovering, hoverHandlers] = useHover();
  const [isDropdownOpen, setDropdownOpen] = React.useState(false);
  const [isEmojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [isEditing, setEditingMessage] = React.useState(false);

  const theme = useTheme();

  const user = state.selectMe();

  const showAsFocused =
    !isEditing &&
    (hasTouchFocus || isHovering || isDropdownOpen || isEmojiPickerOpen);

  const isDirectMessage = channel.kind === "dm";
  const isOwnMessage = user?.id === message.authorUserId;

  const allowEdit =
    !message.isSystemMessage &&
    !message.isAppMessage &&
    user?.id === message.authorUserId;

  const allowDirectMessages = user != null;

  const createdAtDate = React.useMemo(
    () => new Date(message.created_at),
    [message.created_at]
  );

  const initReply = React.useCallback(
    () => initReply_(message.id),
    [message.id, initReply_]
  );

  const initEdit = React.useCallback(() => {
    setEditingMessage(true);
  }, []);

  const showSimplifiedMessage =
    !message.isReply &&
    previousMessage != null &&
    previousMessage.authorId === message.authorId &&
    createdAtDate - new Date(previousMessage.created_at) <
      5 * ONE_MINUTE_IN_MILLIS;

  const reactions = React.useMemo(
    () =>
      message.reactions.map((r) => ({
        ...r,
        authorMembers: r.users
          .map((userId) => members.find((m) => m.id === userId))
          .filter(Boolean),
      })),
    [message.reactions, members]
  );

  const save = React.useCallback(
    (blocks) => actions.updateMessage(message.id, { blocks }),
    [actions, message.id]
  );

  const sendDirectMessageToAuthor = React.useCallback(() => {
    const redirect = (c) => navigate(`/channels/${c.id}`);

    const dmChannel = state.selectDmChannelFromUserId(message.authorUserId);
    if (dmChannel != null) {
      redirect(dmChannel);
      return;
    }

    actions
      .createDmChannel({ memberUserIds: [message.authorUserId] })
      .then(redirect);
  }, [actions, navigate, state, message.authorUserId]);

  const remove = React.useCallback(
    () => actions.removeMessage(message.id),
    [actions, message.id]
  );

  const addReaction = React.useCallback(
    (emoji) => {
      const existingReaction = message.reactions.find((r) => r.emoji === emoji);

      if (existingReaction?.users.includes(user?.id)) return;

      actions.addMessageReaction(message.id, { emoji });
      setEmojiPickerOpen(false);
    },
    [message.id, message.reactions, actions, user?.id]
  );
  const removeReaction = React.useCallback(
    (emoji) => actions.removeMessageReaction(message.id, { emoji }),
    [actions, message.id]
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
                !isOwnMessage && !(isDirectMessage && members.length <= 2),
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
      members.length,
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

  const onClickInteractiveElement = React.useCallback((el) => {
    switch (el.type) {
      case "image-attachment":
        window.open(el.url, "_blank");
        break;
      default:
        throw new Error();
    }
  }, []);

  const editedMessageSuffix = React.useMemo(
    () => (
      <span
        css={css({
          fontSize: "1rem",
          color: "rgb(255 255 255 / 35%)",
        })}
      >
        {" "}
        (edited)
      </span>
    ),
    []
  );

  return (
    <div
      ref={containerRef}
      role="listitem"
      style={{
        background: hasPendingReply
          ? theme.colors.messageBackgroundModifierHighlight
          : showAsFocused
          ? theme.colors.messageBackgroundModifierFocus
          : undefined,
        padding:
          showSimplifiedMessage || compact
            ? "0.5rem 1.6rem"
            : "0.7rem 1.6rem 0.3rem",
      }}
      css={(theme) =>
        css({
          color: message.isOptimistic
            ? theme.colors.textMuted
            : theme.colors.textNormal,
          position: "relative",
          lineHeight: 1.46668,
          userSelect: "text",
        })
      }
      {...(giveTouchFocus == null
        ? hoverHandlers
        : {
            onClick: () => {
              giveTouchFocus(message.id);
            },
          })}
    >
      {!message.isOptimistic && (
        <div
          css={css({
            position: "absolute",
            top: 0,
            right: "1.6rem",
            transform: "translateY(-50%)",
            zIndex: 1,
          })}
          style={{ display: showAsFocused ? "block" : "none" }}
        >
          <MessageToolbar
            allowReplies={!isOwnMessage && !message.isSystemMessage}
            allowEdit={allowEdit}
            allowReactions={user != null}
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

      {message.isReply && (
        <RepliedMessage
          message={message.repliedMessage}
          getMember={getMember}
        />
      )}

      <div
        css={css({
          display: "grid",
          gridTemplateColumns: `${AVATAR_SIZE} minmax(0, 1fr)`,
          alignItems: "flex-start",
          gridGap: compact ? COMPACT_GUTTER_SIZE : GUTTER_SIZE,
        })}
      >
        <MessageLeftColumn
          message={message}
          simplified={showSimplifiedMessage}
          compact={compact}
          isHovering={isHovering}
        />

        <div>
          {!showSimplifiedMessage && (
            <MessageHeader
              compact={compact}
              simplified={showSimplifiedMessage}
              message={message}
              authorUser={message.author}
              createdAt={createdAtDate}
              isOwnMessage={isOwnMessage}
            />
          )}

          {message.isSystemMessage ? (
            <SystemMessageContent message={message} />
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
              getMember={getMember}
            />
          ) : (
            <>
              <RichText
                compact={compact}
                blocks={message.content}
                onClickInteractiveElement={onClickInteractiveElement}
                getMember={getMember}
                suffix={message.isEdited && editedMessageSuffix}
              />

              {message.embeds?.length > 0 && <Embeds messageId={message.id} />}
            </>
          )}

          {reactions.length !== 0 && (
            <Reactions
              items={reactions}
              addReaction={addReaction}
              removeReaction={removeReaction}
              hideAddReactionButton={!isHovering && !hasTouchFocus}
            />
          )}
        </div>
      </div>
    </div>
  );
});

const Embeds = ({ messageId }) => {
  const { state } = useAppScope();
  const message = state.selectMessage(messageId);

  return (
    <ul
      css={css({
        marginTop: "0.5rem",
        maxWidth: "60rem",
        "li + li": { marginTop: "1rem" },
      })}
    >
      {message.embeds.map((embed) => (
        <Embed key={embed.url} {...embed} />
      ))}
    </ul>
  );
};

const Embed = ({ title, url, favicon, metatags }) => {
  const hostname = React.useMemo(() => new URL(url).hostname, [url]);
  const description = metatags["og:description"];
  const image = metatags["og:image"];

  return (
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
      <div css={css({ flex: 1, padding: "0 1.2rem" })}>
        <div
          css={css({
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
          {hostname}
        </div>
        <div css={css({ display: "flex" })}>
          <div css={css({ flex: 1 })}>
            <a
              href={url}
              rel="noreferrer"
              target="_blank"
              css={(t) =>
                css({
                  color: t.colors.link,
                  textDecoration: "none",
                  ":hover": {
                    color: t.colors.linkModifierHover,
                    textDecoration: "underline",
                  },
                })
              }
            >
              {title}
            </a>
            {description != null && <div>{description}</div>}
          </div>
          {image != null && (
            <div
              css={css({
                marginLeft: "1rem",
                paddingTop: "1rem",
                img: { width: "8rem", height: "auto", borderRadius: "0.3rem" },
              })}
            >
              <img src={image} loading="lazy" />
            </div>
          )}
        </div>
      </div>
    </li>
  );
};

const Reactions = ({
  items = [],
  addReaction,
  removeReaction,
  hideAddReactionButton,
}) => {
  const { inputDeviceCanHover } = useGlobalMediaQueries();
  const [isInlineEmojiPickerOpen, setInlineEmojiPickerOpen] =
    React.useState(false);

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
      <AddEmojiReactionIcon />
    </button>
  );
  return (
    <>
      <div
        css={css({
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "auto",
          gridGap: "0.4rem",
          justifyContent: "flex-start",
          margin: "0.5rem -1px 0",
          ":not(:focus-within) [data-fader]": {
            opacity: hideAddReactionButton ? 0 : 1,
          },
          button: {
            display: "flex",
            alignItems: "center",
            height: "2.5rem",
            fontSize: "1.5rem",
            background: "rgb(255 255 255 / 4%)",
            borderRadius: "0.7rem",
            padding: "0 0.7rem 0 0.6rem",
            lineHeight: 1,
            userSelect: "none",
            border: "1px solid transparent",
            cursor: "pointer",
            outline: "none",
            ":focus-visible, &.active:focus-visible": {
              borderColor: "white",
            },
            "&.active": {
              background: "#007ab333",
              borderColor: "#007ab3a8",
            },
            "&:not(.active):hover": {
              borderColor: "rgb(255 255 255 / 20%)",
            },
            ".count": {
              fontSize: "1rem",
              fontWeight: "400",
              color: "rgb(255 255 255 / 70%)",
              marginLeft: "0.5rem",
            },
          },
        })}
      >
        {items.map((r) => {
          const authorDisplayNames = r.authorMembers.map((m) => m.displayName);
          return (
            <Tooltip.Root key={r.emoji}>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => {
                    if (r.hasReacted) {
                      removeReaction(r.emoji);
                      return;
                    }

                    addReaction(r.emoji);
                  }}
                  className={r.hasReacted ? "active" : undefined}
                >
                  <span>{r.emoji}</span>
                  <span className="count">{r.count}</span>
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
                    {r.emoji}
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
        })}

        {inputDeviceCanHover ? (
          <Popover.Root
            placement="top"
            open={isInlineEmojiPickerOpen}
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
        )}
      </div>
    </>
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
        css={(theme) =>
          css({
            height: "0.4rem",
            width: "4.2rem",
            borderRadius: "0.2rem",
            background: theme.colors.interactiveNormal,
            boxShadow:
              "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px",
          })
        }
      />
    </button>
    <div
      css={(theme) =>
        css({
          flex: 1,
          minHeight: 0,
          padding: "0.4rem 0.4rem 0",
          background: theme.colors.dialogBackground,
          borderTopLeftRadius: "0.6rem",
          borderTopRightRadius: "0.6rem",
          boxShadow:
            "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 5px 10px, rgb(15 15 15 / 40%) 0px 15px 40px",
        })
      }
    >
      <EmojiPicker height="100%" onSelect={onSelect} />
    </div>
  </Dialog>
);

const MemberDisplayName = React.forwardRef(
  ({ displayName, color, ...props }, ref) => (
    <button
      ref={ref}
      css={(t) =>
        css({
          lineHeight: 1.2,
          color: color ?? t.colors.textNormal,
          fontWeight: t.text.weights.smallHeader,
          cursor: "pointer",
          outline: "none",
          ":hover, :focus-visible": { textDecoration: "underline" },
        })
      }
      {...props}
    >
      {displayName}
    </button>
  )
);

const MemberDisplayNameWithPopover = React.forwardRef(
  ({ user, color, popoverProps, ...props }, ref) => (
    <Popover.Root placement="right" {...popoverProps}>
      <Popover.Trigger asChild>
        <MemberDisplayName
          ref={ref}
          displayName={user?.displayName}
          color={color}
          {...props}
        />
      </Popover.Trigger>
      <Popover.Content>
        {user != null && <ProfilePreview userId={user.id} />}
      </Popover.Content>
    </Popover.Root>
  )
);

const AppDisplayName = React.forwardRef(
  ({ displayName, color, ...props }, ref) => (
    <div
      ref={ref}
      css={(theme) =>
        css({
          lineHeight: 1.2,
          color: color ?? theme.colors.pink,
          fontWeight: theme.text.weights.smallHeader,
          display: "inline-flex",
          alignItems: "center",
        })
      }
      {...props}
    >
      {displayName}
      <span
        css={(theme) =>
          css({
            marginLeft: "0.5rem",
            padding: "0.2rem 0.3rem",
            lineHeight: 1,
            fontSize: theme.fontSizes.tiny,
            borderRadius: "0.3rem",
            background: theme.colors.backgroundModifierHover,
            color: "rgb(255 255 255 / 56.5%)",
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
      css={(theme) =>
        css({
          color: color ?? theme.colors.pink,
          fontWeight: "500",
        })
      }
      {...props}
    >
      {displayName}
    </span>
  )
);

const MessageHeader = ({
  compact,
  // simplified,
  message,
  authorUser,
  createdAt,
}) => {
  if (message.isSystemMessage) return null;

  if (message.isAppMessage) {
    switch (message.type) {
      case "webhook":
      case "app-installed":
      case "app": {
        const isWaitingForApp = message.app?.name == null;
        return (
          <span
            style={{
              opacity: isWaitingForApp ? 0 : 1,
              marginRight: compact ? "1rem" : 0,
            }}
          >
            <AppDisplayName displayName={message.app?.name ?? "..."} />
          </span>
        );
      }

      default:
        throw new Error();
    }
  }

  if (compact)
    return (
      <Popover.Root placement="right">
        <Popover.Trigger asChild>
          <div
            css={css({
              display: "inline",
              cursor: "pointer",
              ":hover [data-name]": {
                textDecoration: "underline",
              },
            })}
          >
            <Avatar
              url={message.author?.profilePicture.small}
              walletAddress={message.author?.walletAddress}
              size="2rem"
              style={{
                display: "inline",
                verticalAlign: "sub",
                marginRight: "0.7rem",
                transform: "translateY(0.1rem)",
              }}
            />
            <MemberDisplayName
              data-name
              displayName={message.author?.displayName}
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
      `}
    >
      {authorUser != null && (
        <>
          <MemberDisplayNameWithPopover user={authorUser} />

          <TinyMutedText>
            <FormattedDateWithTooltip
              value={createdAt}
              hour="numeric"
              minute="numeric"
              day="numeric"
              month="short"
              tooltipContentProps={{ sideOffset: 8 }}
            />
          </TinyMutedText>

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
        </>
      )}
    </div>
  );
};

// Super hacky and inaccessible
const EmojiPicker = ({ width = "auto", height = "100%", onSelect }) => {
  const inputRef = React.useRef();

  const [emojiData, setEmojiData] = React.useState([]);

  const emojis = React.useMemo(
    () =>
      groupBy(
        (e) => e.category,
        emojiData.filter((e) => parseFloat(e.unicode_version) < 13)
      ),
    [emojiData]
  );

  const [highlightedEntry, setHighlightedEntry] = React.useState(null);

  const [query, setQuery] = React.useState("");
  const trimmedQuery = query.trim().toLowerCase();

  const filteredEmojisByCategoryEntries = React.useMemo(() => {
    const match = (e) =>
      [e.description.toLowerCase(), ...e.aliases, ...e.tags].some((prop) =>
        prop.includes(trimmedQuery)
      );

    return Object.entries(mapValues((es) => es.filter(match), emojis)).filter(
      (entry) => entry[1].length !== 0
    );
  }, [emojis, trimmedQuery]);

  const highlightedEmojiItem =
    highlightedEntry == null
      ? null
      : filteredEmojisByCategoryEntries[highlightedEntry[0]][1][
          highlightedEntry[1]
        ];

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

  React.useEffect(() => {
    import("../emojis").then(({ default: emojis }) => {
      setEmojiData(emojis);
    });
  });

  return (
    <div
      css={css({ display: "flex", flexDirection: "column" })}
      style={{ height, width }}
    >
      <div css={css({ padding: "0.7rem 0.7rem 0.3rem" })}>
        <Input
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
            // : `:${highlightedEmojiItem.aliases?.[0]}:` ?? "Search"
          }
        />
      </div>

      <div
        css={css({
          position: "relative",
          flex: 1,
          overflow: "auto",
          scrollPaddingTop: "3rem",
          scrollPaddingBottom: "0.5rem",
        })}
      >
        {filteredEmojisByCategoryEntries.map(([category, emojis], ci) => (
          <div key={category}>
            <div
              css={(theme) =>
                css({
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: `linear-gradient(-180deg, ${theme.colors.dialogBackground} 50%, transparent)`,
                  padding: "0.6rem 0.9rem",
                  fontSize: "1.2rem",
                  fontWeight: "500",
                  color: "rgb(255 255 255 / 40%)",
                  textTransform: "uppercase",
                  pointerEvents: "none",
                })
              }
            >
              {category}
            </div>
            <div
              css={css({
                display: "grid",
                justifyContent: "space-between",
                padding: "0 0.5rem",
                // gridAutoFlow: "column",
                gridTemplateColumns: "repeat(auto-fill, minmax(3.4rem, 1fr))",
              })}
              // style={{
              //   gridTemplateColumns: `repeat(${ROW_LENGTH}, max-content)`,
              // }}
            >
              {emojis.map(({ emoji }, i) => {
                const isHighlighted =
                  highlightedEntry != null &&
                  highlightedEntry[0] === ci &&
                  highlightedEntry[1] === i;
                return (
                  <Emoji
                    key={emoji}
                    emoji={emoji}
                    isHighlighted={isHighlighted}
                    ref={(el) => {
                      if (el == null) return;
                      if (isHighlighted)
                        el.scrollIntoView({ block: "nearest" });
                    }}
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
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Emoji = React.forwardRef(({ emoji, isHighlighted, ...props }, ref) => (
  <button
    ref={ref}
    data-selected={isHighlighted ? "true" : undefined}
    css={(theme) =>
      css({
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
          background: "rgb(255 255 255 / 10%)",
        },
        "&:focus": {
          position: "relative",
          zIndex: 2,
          boxShadow: `0 0 0 0.2rem ${theme.colors.primary}`,
        },
      })
    }
    {...props}
  >
    {emoji}
  </button>
));

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
            open={isEmojiPickerOpen}
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
                  <AddEmojiReactionIcon style={{ width: "1.6rem" }} />
                  {/* <Popover.Anochor */}
                  {/*   style={{ */}
                  {/*     width: "3.3rem", */}
                  {/*     height: "3.3rem", */}
                  {/*     position: "absolute", */}
                  {/*     top: "50%", */}
                  {/*     left: "50%", */}
                  {/*     transform: "translateY(-50%) translateX(-50%)", */}
                  {/*     pointerEvents: "none", */}
                  {/*   }} */}
                  {/* /> */}
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
            <EditPenIcon />
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
                    css={css({ width: "1.6rem", height: "auto" })}
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
    const [pendingMessage, setPendingMessage] = React.useState(() =>
      normalizeNodes(withoutAttachments(blocks))
    );

    const [isSaving, setSaving] = React.useState(false);

    const allowSubmit = !isSaving;
    const isDisabled = !allowSubmit;

    const submit = async () => {
      if (!allowSubmit) return;

      const blocks = cleanNodes(pendingMessage);

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
            background: theme.colors.channelInputBackground,
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
          initialValue={pendingMessage}
          onChange={(value) => {
            setPendingMessage(value);
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

const RepliedMessage = ({ message, getMember }) => {
  const authorMember = message?.author;
  const showAvatar =
    (message != null || !message?.deleted) && authorMember?.profilePicture;

  return (
    <div
      css={css({
        position: "relative",
        paddingLeft: "5rem",
        marginBottom: "0.5rem",
        ":before": {
          content: '""',
          position: "absolute",
          right: "calc(100% - 5rem + 0.3rem)",
          top: "calc(50% - 1px)",
          width: "2.9rem",
          height: "1.4rem",
          borderTop: "2px solid rgb(255 255 255 / 15%)",
          borderLeft: "2px solid rgb(255 255 255 / 15%)",
          borderRight: 0,
          borderBottom: 0,
          borderTopLeftRadius: "0.4rem",
        },
      })}
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
          <Avatar
            url={authorMember?.profilePicture.small}
            walletAddress={authorMember?.walletAddress}
            size="1.4rem"
          />
        )}

        <div
          css={css({
            fontSize: "1.3rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: "rgb(255 255 255 / 54%)",
          })}
        >
          {message?.deleted ? (
            <span
              css={(theme) =>
                css({ fontStyle: "italic", color: theme.colors.textMuted })
              }
            >
              Message deleted
            </span>
          ) : (
            <>
              {authorMember == null ? (
                <span css={css({ fontWeight: "500" })}>...</span>
              ) : (
                <Popover.Root placement="right">
                  <Popover.Trigger asChild>
                    <span
                      role="button"
                      tabIndex={0}
                      css={css({
                        cursor: "pointer",
                        fontWeight: "500",
                        ":hover": { textDecoration: "underline" },
                      })}
                    >
                      {authorMember.displayName}
                    </span>
                  </Popover.Trigger>
                  <Popover.Content>
                    <ProfilePreview userId={message.authorUserId} />
                  </Popover.Content>
                </Popover.Root>
              )}{" "}
              <span
                role="button"
                tabIndex={0}
                css={(theme) =>
                  css({
                    cursor: "pointer",
                    ":hover": { color: theme.colors.textNormal },
                  })
                }
              >
                <RichText
                  inline
                  blocks={message?.content ?? []}
                  getMember={getMember}
                />
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const MessageLeftColumn = ({ isHovering, simplified, compact, message }) => {
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
            value={new Date(message.created_at)}
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
            value={new Date(message.created_at)}
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

  if (compact)
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
            value={new Date(message.created_at)}
            hour="numeric"
            minute="numeric"
            tooltipContentProps={{ sideOffset: 7 }}
            disableRelative
            disableTooltip={!isHovering}
          />
        </TinyMutedText>
      </div>
    );

  return (
    <div css={css({ padding: "0.2rem 0 0" })}>
      <Popover.Root placement="right">
        <Popover.Trigger asChild>
          <button
            css={(t) =>
              css({
                position: "relative",
                borderRadius: t.avatars.borderRadius,
                overflow: "hidden",
                cursor: "pointer",
                outline: "none",
                ":focus-visible": {
                  boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
                },
                ":hover": {
                  boxShadow: message.author?.profilePicture.isVerifiedNft
                    ? `0 0 0 0.2rem ${t.colors.primary}`
                    : `0 0 0 0.2rem ${t.colors.borderLight}`,
                },
                ":active": { transform: "translateY(0.1rem)" },
              })
            }
          >
            <Avatar
              url={message.author?.profilePicture.small}
              walletAddress={message.author?.walletAddress}
              size="3.8rem"
              pixelSize={38}
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

const SystemMessageContent = ({ message }) => {
  switch (message.type) {
    case "user-invited": {
      const isMissingData = [
        message.inviter?.displayName,
        message.author?.displayName,
      ].some((n) => n == null);

      return (
        <span style={{ opacity: isMissingData ? 0 : 1 }}>
          <MemberDisplayNameWithPopover user={message.inviter} /> added{" "}
          <MemberDisplayNameWithPopover user={message.author} /> to the channel.
        </span>
      );
    }
    case "member-joined": {
      const isMissingData = message.author?.displayName == null;
      return (
        <span style={{ opacity: isMissingData ? 0 : 1 }}>
          <MemberDisplayNameWithPopover user={message.author} /> joined the
          channel. Welcome!
        </span>
      );
    }

    case "channel-updated": {
      const updates = Object.entries(message.updates);
      if (updates.length == 0 || updates.length > 1) {
        return (
          <>
            <MemberDisplayNameWithPopover user={message.author} /> updated the
            channel.
          </>
        );
      }

      let [field, value] = updates[0];

      // Nested switch case baby!
      switch (field) {
        case "description":
          return (
            <>
              <MemberDisplayNameWithPopover user={message.author} />{" "}
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
              <MemberDisplayNameWithPopover user={message.author} />{" "}
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
              <MemberDisplayNameWithPopover user={message.author} /> updated the
              channel {field}.
            </>
          );
      }
    }

    case "app-installed": {
      const isMissingData = [
        message.installer?.displayName,
        message.app?.name,
      ].some((n) => n == null);

      return (
        <span style={{ opacity: isMissingData ? 0 : undefined }}>
          <MemberDisplayNameWithPopover user={message.installer} /> installed a
          new app:{" "}
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
        color: theme.colors.textMuted,
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
    ...props
  }) => {
    const formattedDate =
      !disableRelative && isDateToday(value) ? (
        <span>
          <span css={css({ textTransform: "capitalize" })}>
            <FormattedRelativeTime
              value={0}
              unit="day"
              style="long"
              numeric="auto"
            />
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
