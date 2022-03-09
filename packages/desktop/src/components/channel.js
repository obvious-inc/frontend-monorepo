import React from "react";
import { useParams } from "react-router";
import { css, useTheme } from "@emotion/react";
import { FormattedDate } from "react-intl";
import { useAuth, useAppScope, arrayUtils, objectUtils } from "@shades/common";
import usePageVisibilityChangeListener from "../hooks/page-visibility-change-listener";
import useHover from "../hooks/hover";
import stringifyMessageBlocks from "../slate/stringify";
import {
  createEmptyParagraph,
  isNodeEmpty,
  normalizeNodes,
  cleanNodes,
} from "../slate/utils";
import generateAvatar from "../utils/avatar-generator";
import useCommands from "../hooks/commands";
import { FaceIcon, DotsHorizontalIcon, Pencil1Icon } from "./icons";
import MessageInput from "./message-input";
import RichText from "./rich-text";
import Button from "./button";
import * as Popover from "./popover";
import * as DropdownMenu from "./dropdown-menu";
import * as Toolbar from "./toolbar";
import { Hash as HashIcon } from "./icons";
import { HamburgerMenu as HamburgerMenuIcon } from "./icons";
import { useMenuState } from "./app-layout";

const { groupBy } = arrayUtils;
const { mapValues } = objectUtils;

const useChannelMessages = (channelId) => {
  const { user } = useAuth();
  const { actions, state } = useAppScope();

  const messages = state.selectChannelMessages(channelId);

  const sortedMessages = messages.sort(
    (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
  );

  // Fetch messages when switching channels
  React.useEffect(() => {
    let didChangeChannel = false;

    actions.fetchMessages({ channelId }).then(() => {
      if (didChangeChannel) return;
      actions.markChannelRead({ channelId });
    });

    return () => {
      didChangeChannel = true;
    };
  }, [actions, channelId]);

  // Fetch messages when tab get visibility
  usePageVisibilityChangeListener((state) => {
    if (state !== "visible") return;
    actions.fetchMessages({ channelId });
  });

  const lastMessage = sortedMessages.slice(-1)[0];

  // Make channels as read as new messages arrive
  React.useEffect(() => {
    if (lastMessage?.id == null || lastMessage.author === user.id) return;
    actions.markChannelRead({ channelId });
  }, [lastMessage?.id, lastMessage?.author, user.id, channelId, actions]);

  return sortedMessages;
};

const Channel = () => {
  const params = useParams();
  const { user } = useAuth();
  const { actions, state } = useAppScope();

  const { isEnabled: isMenuEnabled, toggle: toggleMenu } = useMenuState();

  const inputRef = React.useRef();

  const selectedServer = state.selectServer(params.serverId);
  const serverChannels = selectedServer?.channels ?? [];
  const selectedChannel = serverChannels.find((c) => c.id === params.channelId);
  const serverMembers = state.selectServerMembers(params.serverId);
  const serverMembersByUserId = state.selectServerMembersByUserId(
    params.serverId
  );

  const getUserMentionDisplayName = React.useCallback(
    (ref) => {
      const member = serverMembers.find((m) => m.id === ref);
      return member.display_name;
    },
    [serverMembers]
  );

  const messages = useChannelMessages(params.channelId);

  React.useEffect(() => {
    if (selectedChannel?.id == null) return;
    inputRef.current.focus();
  }, [selectedChannel?.id]);

  usePageVisibilityChangeListener((state) => {
    if (state === "visible") return;
    actions.fetchInitialData();
  });

  if (selectedChannel == null) return null;

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
        {isMenuEnabled ? (
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
        ) : (
          <div
            css={(theme) =>
              css({ color: theme.colors.textMuted, marginRight: "0.9rem" })
            }
          >
            <HashIcon style={{ width: "1.9rem" }} />
          </div>
        )}
        <div
          css={(theme) =>
            css({
              fontSize: "1.5rem",
              fontWeight: "600",
              color: theme.colors.textHeader,
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            })
          }
        >
          {selectedChannel.name}
        </div>
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
          {messages.map((m) => (
            <MessageItem
              key={m.id}
              content={m.content}
              authorNick={serverMembersByUserId[m.author].displayName}
              authorWalletAddress={
                serverMembersByUserId[m.author].walletAddress
              }
              reactions={m.reactions}
              timestamp={
                <FormattedDate
                  value={new Date(m.created_at)}
                  hour="numeric"
                  minute="numeric"
                  day="numeric"
                  month="short"
                />
              }
              isEdited={m.edited_at != null}
              canEditMessage={user.id === m.author}
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
              serverMembers={serverMembers}
              getUserMentionDisplayName={getUserMentionDisplayName}
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
      <div css={css({ padding: "0 1.6rem 1.6rem" })}>
        <NewMessageInput
          ref={inputRef}
          submit={(blocks) =>
            actions.createMessage({
              server: params.serverId,
              channel: params.channelId,
              content: stringifyMessageBlocks(blocks),
              blocks,
            })
          }
          placeholder={
            selectedChannel == null ? "..." : `Message #${selectedChannel.name}`
          }
          serverMembers={serverMembers}
          getUserMentionDisplayName={getUserMentionDisplayName}
        />
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
          <FaceIcon />
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
        <Pencil1Icon />
      </Toolbar.Button>
    )}
    <Toolbar.Separator />
    <DropdownMenu.Root modal={false} onOpenChange={onDropdownOpenChange}>
      <Toolbar.Button asChild>
        <DropdownMenu.Trigger>
          <DotsHorizontalIcon />
        </DropdownMenu.Trigger>
      </Toolbar.Button>
      <DropdownMenu.Content>
        <DropdownMenu.Item disabled>Reply</DropdownMenu.Item>
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

const MessageItem = ({
  authorNick,
  authorWalletAddress,
  content,
  timestamp,
  reactions = [],
  isEdited,
  canEditMessage,
  addReaction,
  removeReaction,
  update,
  remove,
  serverMembers,
  getUserMentionDisplayName,
}) => {
  const inputRef = React.useRef();
  const containerRef = React.useRef();

  const { user } = useAuth();

  const [isHovering, hoverHandlers] = useHover();
  const [isDropdownOpen, setDropdownOpen] = React.useState(false);
  const [isEmojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [isEditing, setEditingMessage] = React.useState(false);

  const theme = useTheme();

  const showAsFocused =
    !isEditing && (isHovering || isDropdownOpen || isEmojiPickerOpen);

  const avatarDataUrl = React.useMemo(
    () =>
      generateAvatar({
        seed: authorWalletAddress,
        size: 8,
        scale: 10,
      }),
    [authorWalletAddress]
  );

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
        background: showAsFocused
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
        })}
      >
        <MessageToolbar
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
      <div
        css={css`
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: flex-start;
          grid-gap: 1.2rem;
        `}
      >
        <div css={css({ padding: "0.4rem 0 0" })}>
          <button
            css={css({
              borderRadius: "50%",
              overflow: "hidden",
              cursor: "pointer",
              ":hover": { boxShadow: "0 0 0 0.3rem rgb(255 255 255 / 10%)" },
              ":active": { transform: "translateY(0.1rem)" },
            })}
            onClick={() => {
              alert(`Congratulations, you clicked ${authorNick}’s avatar!`);
            }}
          >
            <img
              src={avatarDataUrl}
              css={(theme) =>
                css({
                  background: theme.colors.backgroundSecondary,
                  height: "3.4rem",
                  width: "3.4rem",
                })
              }
            />
          </button>
        </div>
        <div>
          <div
            css={css`
              display: grid;
              grid-template-columns: repeat(2, minmax(0, auto));
              justify-content: flex-start;
              align-items: flex-end;
              grid-gap: 1.2rem;
              margin: 0 0 0.4rem;
              cursor: default;
            `}
          >
            <button
              css={(theme) =>
                css({
                  lineHeight: 1.2,
                  color: theme.colors.pink,
                  fontWeight: "500",
                  fontVariantLigatures: "no-contextual",
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
              onClickUserMention={(mention) => {
                const mentionDisplayName = getUserMentionDisplayName(
                  mention.ref
                );
                alert(`Congratulations, you clicked "@${mentionDisplayName}"!`);
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
                return (
                  <button
                    key={r.emoji}
                    onClick={() => {
                      if (isLoggedInUserReaction) {
                        removeReaction(r.emoji);
                        return;
                      }

                      addReaction(r.emoji);
                    }}
                    className={isLoggedInUserReaction ? "active" : undefined}
                  >
                    <span>{r.emoji}</span>
                    <span className="count">{r.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EditMessageInput = React.forwardRef(
  ({ blocks, save, remove, onCancel, ...props }, editorRef) => {
    const [pendingMessage, setPendingMessage] = React.useState(() =>
      normalizeNodes(blocks)
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

const NewMessageInput = React.forwardRef(({ submit, ...props }, editorRef) => {
  const [pendingMessage, setPendingMessage] = React.useState(() => [
    createEmptyParagraph(),
  ]);
  const { serverId } = useParams();

  const { execute: executeCommand, isCommand } = useCommands();

  const executeMessage = async () => {
    const blocks = cleanNodes(pendingMessage);

    const isEmpty = blocks.every(isNodeEmpty);

    if (isEmpty) return;

    const messageString = editorRef.current.string();

    if (messageString.startsWith("/")) {
      const [commandName, ...args] = messageString
        .slice(1)
        .split(" ")
        .map((s) => s.trim());

      if (isCommand(commandName)) {
        await executeCommand(commandName, {
          args,
          editor: editorRef.current,
          serverId,
        });
        return;
      }
    }

    await submit(blocks);
    editorRef.current.clear();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        executeMessage();
      }}
      css={(theme) =>
        css({
          position: "relative",
          padding: "1rem 1.5rem",
          background: theme.colors.channelInputBackground,
          borderRadius: "0.7rem",
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
        }}
        {...props}
      />
      <input type="submit" hidden />
    </form>
  );
});

export default Channel;
