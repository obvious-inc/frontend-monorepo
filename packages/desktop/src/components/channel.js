import React from "react";
import { useParams } from "react-router";
import { css } from "@emotion/react";
import { FormattedDate } from "react-intl";
import { useAuth, useAppScope, arrayUtils, objectUtils } from "@shades/common";
import usePageVisibilityChangeListener from "../hooks/page-visibility-change-listener";
import useHover from "../hooks/hover";
import { FaceIcon, DotsHorizontalIcon, Pencil1Icon } from "./icons";
import AutoAdjustingHeightTextarea from "./auto-adjusting-height-textarea";
import Button from "./button";
import * as Popover from "./popover";
import * as DropdownMenu from "./dropdown-menu";
import * as Toolbar from "./toolbar";

const { groupBy } = arrayUtils;
const { mapValues } = objectUtils;

const useChannelMessages = (channelId) => {
  const { actions, state } = useAppScope();

  const messages = state.selectChannelMessages(channelId);

  React.useEffect(() => {
    actions.fetchMessages({ channelId });
  }, [actions, channelId]);

  usePageVisibilityChangeListener((state) => {
    if (state !== "visible") return;
    actions.fetchMessages({ channelId });
  });

  const sortedMessages = messages.sort(
    (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
  );

  return sortedMessages;
};

const Channel = () => {
  const params = useParams();
  const { user } = useAuth();
  const { actions, state } = useAppScope();

  const inputRef = React.useRef();

  const selectedServer = state.selectServer(params.serverId);
  const serverChannels = selectedServer?.channels ?? [];
  const selectedChannel = serverChannels.find((c) => c.id === params.channelId);
  const serverMembersByUserId = state.selectServerMembersByUserId(
    params.serverId
  );

  const messages = useChannelMessages(params.channelId);

  const lastMessage = messages.slice(-1)[0];

  // Fetch messages when switching channels
  React.useEffect(() => {
    let didChangeChannel = false;

    actions.fetchMessages({ channelId: params.channelId }).then((messages) => {
      // Mark empty channels as read
      if (didChangeChannel || messages.length !== 0) return;
      actions.markChannelRead({ channelId: params.channelId });
    });

    return () => {
      didChangeChannel = true;
    };
  }, [actions, params.channelId]);

  // Make channels as read as new messages arrive
  React.useEffect(() => {
    if (lastMessage?.id == null || lastMessage.author === user.id) return;
    actions.markChannelRead({ channelId: params.channelId });
  }, [
    lastMessage?.id,
    lastMessage?.author,
    user.id,
    params.channelId,
    actions,
  ]);

  React.useEffect(() => {
    if (selectedChannel?.id == null) return;
    inputRef.current.focus();
  }, [selectedChannel?.id]);

  usePageVisibilityChangeListener((state) => {
    if (state === "visible") return;
    actions.fetchUserData();
  });

  if (selectedChannel == null) return null;

  return (
    <div
      css={css`
        flex: 1;
        background: rgb(255 255 255 / 3%);
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      `}
    >
      <div
        css={css`
          overflow: auto;
          font-size: 1.3rem;
          font-weight: 300;
          padding: 1.6rem 0 0;
          overscroll-behavior-y: contain;
          scroll-snap-type: y proximity;
        `}
      >
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            content={m.content}
            author={serverMembersByUserId[m.author].display_name}
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
            update={(content) => actions.updateMessage(m.id, { content })}
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
          />
        ))}
        <div
          css={css`
            height: 1.6rem;
            scroll-snap-align: end;
          `}
        />
      </div>
      <NewMessageInput
        ref={inputRef}
        submit={(content) =>
          actions.createMessage({
            server: params.serverId,
            channel: params.channelId,
            content,
          })
        }
        placeholder={
          selectedChannel == null ? "..." : `Message #${selectedChannel.name}`
        }
      />
    </div>
  );
};

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
              background: "rgb(0 0 0 / 20%)",
              fontSize: "1.3rem",
              fontWeight: "300",
              borderRadius: "0.3rem",
              padding: "0.5rem 0.7rem",
              width: "100%",
              outline: "none",
              border: 0,
              "&::placeholder": { fontWeight: "400" },
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
              css={css({
                position: "sticky",
                top: 0,
                zIndex: 1,
                background:
                  "linear-gradient(-180deg, hsl(0 0% 18%) 50%, transparent)",
                padding: "0.6rem 0.9rem",
                fontSize: "1.2rem",
                fontWeight: "500",
                color: "rgb(255 255 255 / 40%)",
                textTransform: "uppercase",
              })}
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
  author,
  content,
  timestamp,
  reactions = [],
  isEdited,
  canEditMessage,
  addReaction,
  removeReaction,
  update,
  remove,
}) => {
  const inputRef = React.useRef();
  const containerRef = React.useRef();

  const { user } = useAuth();

  const [isHovering, hoverHandlers] = useHover();
  const [isDropdownOpen, setDropdownOpen] = React.useState(false);
  const [isEmojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [isEditing, setEditingMessage] = React.useState(false);

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
        background: isEditing
          ? "rgb(255 255 255 / 3%)"
          : showAsFocused
          ? "rgb(255 255 255 / 1%)"
          : undefined,
      }}
      css={css`
        position: relative;
        line-height: 1.6;
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
          grid-template-columns: repeat(2, minmax(0, auto));
          justify-content: flex-start;
          align-items: flex-end;
          grid-gap: 1.2rem;
          margin: 0 0 0.4rem;
          cursor: default;
        `}
      >
        <div
          css={(theme) => css`
            line-height: 1.2;
            color: ${theme.colors.pink};
            font-weight: 500;
          `}
        >
          {author}
        </div>
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
          value={content}
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
        />
      ) : (
        <div
          css={css`
            white-space: pre-wrap;
          `}
        >
          {content}
          {isEdited && (
            <>
              {" "}
              <span
                css={css({ fontSize: "1rem", color: "rgb(255 255 255 / 35%)" })}
              >
                (edited)
              </span>
            </>
          )}
        </div>
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
  );
};

const EditMessageInput = React.forwardRef(
  ({ value, save, remove, onCancel, ...props }, ref) => {
    const formRef = React.useRef();
    const [pendingMessage, setPendingMessage] = React.useState(value);
    const [isSaving, setSaving] = React.useState(false);

    const submit = async () => {
      if (!hasChanges) {
        onCancel();
        return;
      }

      const isEmpty = pendingMessage.trim().length === 0;

      setSaving(true);
      try {
        if (
          isEmpty &&
          confirm("Are you sure you want to remove this message?")
        ) {
          remove();
          return;
        }

        save(pendingMessage);
      } catch (e) {
        console.error(e);
        setSaving(false);
      }
    };

    const hasChanges = pendingMessage.trim() !== value;
    const allowSubmit = !isSaving;

    return (
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <AutoAdjustingHeightTextarea
          ref={ref}
          rows={1}
          value={pendingMessage}
          onChange={(e) => setPendingMessage(e.target.value)}
          style={{
            font: "inherit",
            fontSize: "1.3rem",
            padding: 0,
            background: "none",
            color: "white",
            border: 0,
            borderRadius: "0.5rem",
            outline: "none",
            display: "block",
            width: "100%",
          }}
          placeholder={`Press "Enter" to delete message`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onCancel();
              return;
            }

            if (!e.shiftKey && e.key === "Enter") {
              e.preventDefault();
              if (!allowSubmit) return;
              submit();
            }
          }}
          {...props}
        />
        <div css={css({ display: "flex", justifyContent: "flex-end" })}>
          <div
            css={css({
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(max-content, 1fr))",
              justifyContent: "flex-end",
              gridGap: "1rem",
              padding: "1rem 0",
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

const NewMessageInput = React.forwardRef(
  ({ submit: submit_, placeholder }, ref) => {
    const formRef = React.useRef();
    const [pendingMessage, setPendingMessage] = React.useState("");

    const submit = async () => {
      submit_(pendingMessage);
      setPendingMessage("");
    };

    return (
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        css={css`
          padding: 0 1.6rem 1.6rem;
        `}
      >
        <div
          css={css({
            padding: "1.4rem 1.6rem",
            background: "rgb(255 255 255 / 4%)",
            borderRadius: "0.5rem",
          })}
        >
          <AutoAdjustingHeightTextarea
            ref={ref}
            rows={1}
            value={pendingMessage}
            onChange={(e) => setPendingMessage(e.target.value)}
            style={{
              background: "none",
              font: "inherit",
              fontSize: "1.3rem",
              color: "white",
              border: 0,
              outline: "none",
              display: "block",
              width: "100%",
              resize: "none",
            }}
            placeholder={placeholder}
            onKeyPress={(e) => {
              if (!e.shiftKey && e.key === "Enter") {
                e.preventDefault();
                if (pendingMessage.trim().length === 0) return;
                submit();
              }
            }}
          />
        </div>
        <input
          type="submit"
          hidden
          disabled={pendingMessage.trim().length === 0}
        />
      </form>
    );
  }
);

export default Channel;
