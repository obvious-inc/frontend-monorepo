import React from "react";
import { useParams } from "react-router";
import { css, useTheme } from "@emotion/react";
import {
  useAuth,
  useAppScope,
  arrayUtils,
  objectUtils,
  messageUtils,
} from "@shades/common";
import useHover from "../hooks/hover";
import { isNodeEmpty, normalizeNodes, cleanNodes } from "../slate/utils";
import {
  DotsHorizontal as DotsHorizontalIcon,
  EditPen as EditPenIcon,
} from "./icons";
import MessageInput from "./message-input";
import RichText from "./rich-text";
import Button from "./button";
import ServerMemberAvatar from "./server-member-avatar";
import * as Popover from "./popover";
import * as DropdownMenu from "./dropdown-menu";
import * as Toolbar from "./toolbar";
import * as Tooltip from "./tooltip";
import { AddEmojiReaction as AddEmojiReactionIcon } from "./icons";

const { groupBy } = arrayUtils;
const { mapValues } = objectUtils;
const { withoutAttachments } = messageUtils;

const ChannelMessage = ({
  authorNick,
  authorWalletAddress,
  authorUserId,
  avatarVerified,
  content,
  timestamp,
  reactions = [],
  hasPendingReply,
  isReply,
  repliedMessage,
  isEdited,
  canEditMessage,
  initReply,
  addReaction,
  removeReaction,
  update,
  remove,
  serverMembers,
  getUserMentionDisplayName,
}) => {
  const inputRef = React.useRef();
  const containerRef = React.useRef();

  const params = useParams();
  const { user } = useAuth();
  const { state } = useAppScope();

  const [isHovering, hoverHandlers] = useHover();
  const [isDropdownOpen, setDropdownOpen] = React.useState(false);
  const [isEmojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [isEditing, setEditingMessage] = React.useState(false);

  const [isInlineEmojiPickerOpen, setInlineEmojiPickerOpen] =
    React.useState(false);

  const theme = useTheme();

  const showAsFocused =
    !isEditing && (isHovering || isDropdownOpen || isEmojiPickerOpen);

  React.useEffect(() => {
    if (!isEditing) return;

    inputRef.current.focus();
    containerRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [isEditing]);

  return (
    <div
      ref={containerRef}
      style={{
        background: hasPendingReply
          ? "#3f42ea2b"
          : showAsFocused
          ? theme.colors.messageHoverBackground
          : undefined,
      }}
      css={css`
        position: relative;
        line-height: 1.46668;
        padding: 0.7rem 1.6rem 0.5rem;
        user-select: text;
      `}
      {...hoverHandlers}
    >
      <div
        css={css({
          position: "absolute",
          top: 0,
          right: "1.6rem",
          transform: "translateY(-50%)",
          display: showAsFocused ? "block" : "none",
          zIndex: 1,
        })}
      >
        <MessageToolbar
          initReply={initReply}
          canEditMessage={canEditMessage}
          startEditMode={() => {
            setEditingMessage(true);
          }}
          addReaction={(emoji) => {
            addReaction(emoji);
            setEmojiPickerOpen(false);
          }}
          requestMessageRemoval={() => {
            if (confirm("Are you sure you want to remove this message?"))
              remove();
          }}
          onDropdownOpenChange={(isOpen) => {
            setDropdownOpen(isOpen);
          }}
          isEmojiPickerOpen={isEmojiPickerOpen}
          onEmojiPickerOpenChange={(isOpen) => {
            setEmojiPickerOpen(isOpen);
          }}
        />
      </div>

      {isReply && <RepliedMessage message={repliedMessage} />}
      <div
        css={css`
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: flex-start;
          grid-gap: 1.2rem;
        `}
      >
        <div css={css({ padding: "0.4rem 0 0" })}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                css={css({
                  position: "relative",
                  borderRadius: "0.3rem",
                  overflow: "hidden",
                  cursor: "pointer",
                  ":hover": {
                    boxShadow: avatarVerified
                      ? "0 0 0 2px #4f52ff"
                      : "0 0 0 2px rgb(255 255 255 / 10%)",
                  },
                  ":active": { transform: "translateY(0.1rem)" },
                })}
                onClick={() => {
                  alert(`Congratulations, you clicked ${authorNick}’s avatar!`);
                }}
              >
                <ServerMemberAvatar
                  userId={authorUserId}
                  serverId={params.serverId}
                  size="3.4rem"
                />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content
              side="top"
              sideOffset={6}
              css={css({ padding: "0.4rem", borderRadius: "0.6rem" })}
            >
              {avatarVerified && (
                <div
                  css={(theme) =>
                    css({
                      fontSize: "1rem",
                      margin: "0 0 0.3rem",
                      color: theme.colors.textNormal,
                    })
                  }
                >
                  NFT verified
                </div>
              )}
              <ServerMemberAvatar
                userId={authorUserId}
                serverId={params.serverId}
                size="6.4rem"
              />
            </Tooltip.Content>
          </Tooltip.Root>
        </div>
        <div>
          <div
            css={css`
              display: grid;
              grid-template-columns: repeat(2, minmax(0, auto));
              justify-content: flex-start;
              align-items: flex-end;
              grid-gap: 1.2rem;
              margin: 0 0 0.2rem;
              cursor: default;
            `}
          >
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  css={(theme) =>
                    css({
                      lineHeight: 1.2,
                      color: theme.colors.pink,
                      fontWeight: "500",
                      cursor: "pointer",
                      ":hover": {
                        textDecoration: "underline",
                      },
                    })
                  }
                  onClick={() => {
                    alert(`Congratulations, you clicked ${authorNick}!`);
                  }}
                >
                  {authorNick}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" sideOffset={4}>
                <span css={css({ color: "rgb(255 255 255 / 54%)" })}>
                  {authorWalletAddress}
                </span>
              </Tooltip.Content>
            </Tooltip.Root>
            <div
              css={css`
                color: rgb(255 255 255 / 35%);
                font-size: 1rem;
              `}
            >
              {timestamp}
            </div>
          </div>
          {isEditing ? (
            <EditMessageInput
              ref={inputRef}
              blocks={content}
              onCancel={() => {
                setEditingMessage(false);
              }}
              remove={remove}
              save={(content) =>
                update(content).then((message) => {
                  setEditingMessage(false);
                  return message;
                })
              }
              serverMembers={serverMembers}
              getUserMentionDisplayName={getUserMentionDisplayName}
            />
          ) : (
            <RichText
              blocks={content}
              onClickInteractiveElement={(el) => {
                switch (el.type) {
                  case "user": {
                    const mentionDisplayName = getUserMentionDisplayName(
                      el.ref
                    );
                    alert(
                      `Congratulations, you clicked "@${mentionDisplayName}"!`
                    );
                    break;
                  }
                  case "image-attachment":
                    window.open(el.url, "_blank");
                    break;
                  default:
                    throw new Error();
                }
              }}
              getUserMentionDisplayName={getUserMentionDisplayName}
            >
              {isEdited && (
                <span
                  css={css({
                    fontSize: "1rem",
                    color: "rgb(255 255 255 / 35%)",
                  })}
                >
                  (edited)
                </span>
              )}
            </RichText>
          )}

          {reactions.length !== 0 && (
            <div
              css={css({
                display: "grid",
                gridAutoFlow: "column",
                gridAutoColumns: "auto",
                gridGap: "0.4rem",
                justifyContent: "flex-start",
                margin: "0.5rem -1px 0",
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
                  "&.active": {
                    background: "#3f42ea45",
                    borderColor: "#4c4ffe96",
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
              {reactions.map((r) => {
                const isLoggedInUserReaction = r.users.includes(user.id);
                const members = r.users
                  .map((id) =>
                    state.selectServerMemberWithUserId(params.serverId, id)
                  )
                  .map((m) => m.displayName);
                return (
                  <Tooltip.Root key={r.emoji}>
                    <Tooltip.Trigger asChild>
                      <button
                        onClick={() => {
                          if (isLoggedInUserReaction) {
                            removeReaction(r.emoji);
                            return;
                          }

                          addReaction(r.emoji);
                        }}
                        className={
                          isLoggedInUserReaction ? "active" : undefined
                        }
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
                          css={css({ fontSize: "2.8rem", lineHeight: "1.1" })}
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
                            members.slice(0, -1).join(", "),
                            members.slice(-1)[0],
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

              <Popover.Root
                open={isInlineEmojiPickerOpen}
                onOpenChange={(isOpen) => {
                  setInlineEmojiPickerOpen(isOpen);
                }}
              >
                <Popover.Trigger asChild>
                  <button
                    css={css({
                      color: "white",
                      border: "1px solid white",
                      transition: "0.1s opacity ease-out",
                      svg: { width: "1.6rem", height: "auto" },
                    })}
                    style={{ opacity: isHovering ? 1 : 0 }}
                  >
                    <AddEmojiReactionIcon />
                  </button>
                </Popover.Trigger>
                <Popover.Content
                  side="top"
                  align="center"
                  sideOffset={4}
                  style={{
                    width: "31.6rem",
                    height: "28.4rem",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Popover.Arrow />
                  <EmojiPicker
                    addReaction={(...args) => {
                      setInlineEmojiPickerOpen(false);
                      return addReaction(...args);
                    }}
                  />
                </Popover.Content>
              </Popover.Root>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Super hacky and inaccessible
const EmojiPicker = ({ addReaction }) => {
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

  const [query, setQuery] = React.useState("");
  const trimmedQuery = query.trim().toLowerCase();

  const filteredEmojisByCategory = React.useMemo(() => {
    const match = (e) =>
      [e.description.toLowerCase(), ...e.aliases, ...e.tags].some((prop) =>
        prop.includes(trimmedQuery)
      );

    return Object.fromEntries(
      Object.entries(mapValues((es) => es.filter(match), emojis)).filter(
        (entry) => entry[1].length !== 0
      )
    );
  }, [emojis, trimmedQuery]);

  React.useEffect(() => {
    inputRef.current.focus();
  }, []);

  React.useEffect(() => {
    import("../emojis").then(({ default: emojis }) => {
      setEmojiData(emojis);
    });
  });

  return (
    <>
      <div css={css({ padding: "0.7rem 0.7rem 0.3rem" })}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          css={(theme) =>
            css({
              color: "white",
              background: theme.colors.backgroundSecondary,
              fontSize: "1.5rem",
              fontWeight: "400",
              borderRadius: "0.3rem",
              padding: "0.5rem 0.7rem",
              width: "100%",
              outline: "none",
              border: 0,
              "&:focus": {
                boxShadow: `0 0 0 0.2rem ${theme.colors.primary}`,
              },
            })
          }
        />
      </div>

      <div css={css({ position: "relative", flex: 1, overflow: "auto" })}>
        {Object.entries(filteredEmojisByCategory).map(([category, emojis]) => (
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
                })
              }
            >
              {category}
            </div>
            <div
              css={css({
                display: "grid",
                gridTemplateColumns: "repeat(9, max-content)",
                padding: "0 0.5rem",
              })}
            >
              {emojis.map(({ emoji }) => (
                <button
                  key={emoji}
                  onClick={() => {
                    addReaction(emoji);
                  }}
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
                      "&:hover": {
                        background: "rgb(255 255 255 / 10%)",
                      },
                      "&:focus": {
                        position: "relative",
                        zIndex: 2,
                        boxShadow: `0 0 0 0.2rem ${theme.colors.primary}`,
                      },
                    })
                  }
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

const MessageToolbar = ({
  canEditMessage,
  startEditMode,
  initReply,
  addReaction,
  requestMessageRemoval,
  onDropdownOpenChange,
  isEmojiPickerOpen,
  onEmojiPickerOpenChange,
}) => (
  <Toolbar.Root>
    <Popover.Root
      open={isEmojiPickerOpen}
      onOpenChange={onEmojiPickerOpenChange}
    >
      <Toolbar.Button
        asChild
        aria-label="Add reaction"
        style={{ position: "relative" }}
      >
        <Popover.Trigger>
          <AddEmojiReactionIcon style={{ width: "1.6rem" }} />
          <Popover.Anochor
            style={{
              width: "3.3rem",
              height: "3.3rem",
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translateY(-50%) translateX(-50%)",
              pointerEvents: "none",
            }}
          />
        </Popover.Trigger>
      </Toolbar.Button>
      <Popover.Content
        side="left"
        align="center"
        sideOffset={4}
        style={{
          width: "31.6rem",
          height: "28.4rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Popover.Arrow offset={13} />
        <EmojiPicker addReaction={addReaction} />
      </Popover.Content>
    </Popover.Root>

    {canEditMessage && (
      <Toolbar.Button
        onClick={() => {
          startEditMode();
        }}
        aria-label="Edit"
      >
        <EditPenIcon />
      </Toolbar.Button>
    )}
    <Toolbar.Separator />
    <DropdownMenu.Root modal={false} onOpenChange={onDropdownOpenChange}>
      <Toolbar.Button asChild>
        <DropdownMenu.Trigger>
          <DotsHorizontalIcon css={css({ width: "1.6rem", height: "auto" })} />
        </DropdownMenu.Trigger>
      </Toolbar.Button>
      <DropdownMenu.Content>
        <DropdownMenu.Item onSelect={initReply}>Reply</DropdownMenu.Item>
        <DropdownMenu.Item disabled>Mark unread</DropdownMenu.Item>
        {canEditMessage && (
          <>
            <DropdownMenu.Item
              onSelect={() => {
                startEditMode();
              }}
            >
              Edit message
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={requestMessageRemoval}
              style={{ color: "#ff5968" }}
            >
              Delete message
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </Toolbar.Root>
);

const EditMessageInput = React.forwardRef(
  ({ blocks, save, remove, onCancel, ...props }, editorRef) => {
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
        if (
          isEmpty &&
          confirm("Are you sure you want to remove this message?")
        ) {
          await remove();
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

const RepliedMessage = ({ message }) => {
  const params = useParams();
  const { state } = useAppScope();
  const authorMember =
    message == null
      ? null
      : state.selectServerMemberWithUserId(params.serverId, message.author);

  return (
    <div
      css={css({
        position: "relative",
        paddingLeft: "4.6rem",
        marginBottom: "0.5rem",
        ":before": {
          content: '""',
          position: "absolute",
          right: "calc(100% - 4.6rem + 0.3rem)",
          top: "calc(50% - 1px)",
          width: "2.7rem",
          height: "1.6rem",
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
          display: "grid",
          gridTemplateColumns: "1.4rem minmax(0,1fr)",
          alignItems: "center",
          gridGap: "0.5rem",
        })}
      >
        {message == null ? (
          <div
            style={{
              width: "1.4rem",
              height: "1.4rem",
              borderRadius: "0.2rem",
              background: "rgb(255 255 255 / 10%)",
            }}
          />
        ) : (
          <ServerMemberAvatar
            userId={message.author}
            serverId={params.serverId}
            size="1.4rem"
            borderRadius="0.2rem"
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
          <span
            role="button"
            tabIndex={0}
            css={css({
              cursor: "pointer",
              fontWeight: "500",
              ":hover": { textDecoration: "underline" },
            })}
            onClick={() => {
              alert(
                `Congratulations, you clicked "${authorMember?.displayName}"`
              );
            }}
          >
            {authorMember?.displayName ?? "..."}
          </span>{" "}
          <span
            role="button"
            tabIndex={0}
            css={(theme) =>
              css({
                cursor: "pointer",
                ":hover": { color: theme.colors.textNormal },
              })
            }
            onClick={() => {
              alert("Congratulations, you clicked a replied message!");
            }}
          >
            <RichText inline blocks={message?.content ?? []} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChannelMessage;
