import isToday from "date-fns/isToday";
import isYesterday from "date-fns/isYesterday";
import React from "react";
import { useParams, Link } from "react-router-dom";
import { css } from "@emotion/react";
import { message as messageUtils } from "@shades/common/utils";
import {
  useMe,
  useActions,
  useChannel,
  useChannelMessages,
  useMessage,
} from "@shades/common/app";
import theme from "@shades/ui-web/theme";
import Button from "@shades/ui-web/button";
import MainHeader from "./main-header.js";
import HeaderItem from "./header-item.js";
import IconButton from "./icon-button.js";
import FormattedDate from "./formatted-date.js";
import UserAvatar from "./user-avatar.js";

const Channel = () => {
  const params = useParams();
  const { fetchChannel, fetchMessages, createMessage, markChannelRead } =
    useActions();

  const channel = useChannel(params.channelId, { name: true });
  const messages_ = useChannelMessages(params.channelId);
  const messages = [...messages_].reverse();

  const [selectedMessageId, setSelectedMessageId] = React.useState(
    () => messages.slice(-1)[0]?.id
  );

  const formContainerRef = React.useRef();

  const sendReply = React.useCallback(
    async (message, { targetMessageId } = {}) => {
      await Promise.all([
        markChannelRead(params.channelId),
        createMessage({
          channel: params.channelId,
          blocks: [messageUtils.createParagraphElement(message)],
          replyToMessageId: targetMessageId,
        }),
      ]);
      setSelectedMessageId(null);
    },
    [markChannelRead, createMessage, params.channelId]
  );

  React.useEffect(() => {
    fetchChannel(params.channelId);
  }, [fetchChannel, params.channelId]);

  React.useEffect(() => {
    fetchMessages(params.channelId).then((messages) => {
      setSelectedMessageId(messages[0]?.id);
      formContainerRef.current?.scrollIntoView();
    });
  }, [fetchMessages, params.channelId]);

  React.useEffect(() => {
    if (formContainerRef.current == null) return;
    formContainerRef.current.scrollIntoView({ block: "nearest" });
  }, [selectedMessageId]);

  if (messages.length === 0) return null;

  return (
    <div
      css={(t) =>
        css({
          position: "relative",
          zIndex: 0,
          flex: 1,
          minWidth: "min(30.6rem, 100vw)",
          background: t.colors.backgroundPrimary,
          display: "flex",
          height: "100%",
        })
      }
    >
      <div
        css={css({
          flex: 1,
          minWidth: "min(30.6rem, 100vw)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        })}
      >
        <MainHeader
          css={css({
            padding: "0 2rem",
            "@media (min-width: 600px)": {
              padding: "0 4rem",
            },
          })}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "2.6rem",
                display: "flex",
                justifyContent: "center",
                marginRight: "1rem",
              }}
            >
              <IconButton
                component={Link}
                to="/"
                css={css({ color: "inherit" })}
              >
                <svg
                  viewBox="0 0 64 64"
                  style={{ width: "1.6rem", height: "auto" }}
                >
                  <path
                    d="m56.12,35H19.36l16.76,16.76-4.24,4.24L7.88,32,31.88,8l4.24,4.24-16.76,16.76h36.76v6Z"
                    fill="currentColor"
                  />
                </svg>
              </IconButton>
            </div>
            <HeaderItem label={channel?.name} />
          </div>
          <div
            css={(t) =>
              css({
                display: "grid",
                gridAutoColumns: "auto",
                gridAutoFlow: "column",
                gridGap: "2rem",
                alignItems: "center",
                color: t.colors.textNormal,
              })
            }
          >
            <svg
              viewBox="0 0 17 17"
              style={{
                display: "block",
                width: "1.6rem",
                height: "auto",
              }}
            >
              <path
                d="M6.78027 13.6729C8.24805 13.6729 9.60156 13.1982 10.709 12.4072L14.875 16.5732C15.0684 16.7666 15.3232 16.8633 15.5957 16.8633C16.167 16.8633 16.5713 16.4238 16.5713 15.8613C16.5713 15.5977 16.4834 15.3516 16.29 15.1582L12.1504 11.0098C13.0205 9.86719 13.5391 8.45215 13.5391 6.91406C13.5391 3.19629 10.498 0.155273 6.78027 0.155273C3.0625 0.155273 0.0214844 3.19629 0.0214844 6.91406C0.0214844 10.6318 3.0625 13.6729 6.78027 13.6729ZM6.78027 12.2139C3.87988 12.2139 1.48047 9.81445 1.48047 6.91406C1.48047 4.01367 3.87988 1.61426 6.78027 1.61426C9.68066 1.61426 12.0801 4.01367 12.0801 6.91406C12.0801 9.81445 9.68066 12.2139 6.78027 12.2139Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </MainHeader>
        <div
          css={css({
            position: "relative",
            flex: 1,
            display: "flex",
            minHeight: 0,
            minWidth: 0,
          })}
        >
          <div
            css={css({
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              overflowY: "scroll",
              overflowX: "hidden",
              minHeight: 0,
              flex: 1,
              overflowAnchor: "none",
            })}
          >
            <div
              css={css({
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "stretch",
                minHeight: "100%",
                paddingBottom: "0.5rem",
              })}
            >
              {messages.map((m, i) =>
                m.id === selectedMessageId ? (
                  <div
                    key={`${m.id}-reply-form`}
                    ref={formContainerRef}
                    css={css({ padding: "1.5rem 2rem" })}
                  >
                    <ReplyForm
                      messageId={m.id}
                      sendReply={sendReply}
                      isLastMessage={i === messages.length - 1}
                    />
                  </div>
                ) : (
                  <MessageItem
                    key={m.id}
                    id={m.id}
                    onClick={() => setSelectedMessageId(m.id)}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </div>
      <div
        css={(t) =>
          css({
            display: "none",
            "@media (min-width: 800px)": {
              display: "block",
              width: "32rem",
              background: t.colors.backgroundSecondary,
            },
          })
        }
      />
    </div>
  );
};

const ReplyForm = ({ messageId, sendReply, isLastMessage }) => {
  const me = useMe();
  const message = useMessage(messageId);
  const [hasPendingSubmit, setPending] = React.useState(false);
  const [replyContent, setReplyContent] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setPending(true);
        sendReply(replyContent.trim(), {
          targetMessageId: isLastMessage ? undefined : messageId,
        }).finally(() => {
          setPending(false);
        });
      }}
      css={(t) =>
        css({
          background: t.colors.backgroundSecondary,
          padding: "2rem",
          borderRadius: "0.5rem",
          color: t.colors.textDimmed,
          fontSize: t.fontSizes.large,
        })
      }
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <UserAvatar
            walletAddress={message?.author?.walletAddress}
            size="2.6rem"
            background={theme.colors.backgroundTertiary}
          />
          <div
            css={(t) =>
              css({
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
                minWidth: 0,
                fontSize: t.fontSizes.large,
                color: t.colors.textDimmed,
                marginLeft: "1rem",
              })
            }
          >
            {message?.author?.displayName}
          </div>
        </div>
        <div
          css={(t) =>
            css({ fontSize: t.fontSizes.small, color: t.colors.textMuted })
          }
        >
          {message &&
            (isToday(new Date(message.createdAt)) ? (
              <FormattedDate
                value={new Date(message.createdAt)}
                hour="numeric"
                minute="numeric"
              />
            ) : isYesterday(new Date(message.createdAt)) ? (
              "Yesterday"
            ) : (
              <FormattedDate
                value={new Date(message.createdAt)}
                month="short"
                day="numeric"
              />
            ))}
        </div>
      </div>
      <div
        css={(t) =>
          css({
            fontSize: t.fontSizes.large,
            color: t.colors.textDimmed,
            whiteSpace: "pre-line",
            margin: "2rem 0",
            paddingBottom: "2rem",
            borderBottom: "0.1rem solid",
            borderColor: t.colors.borderLight,
          })
        }
      >
        {message.repliedMessage?.stringContent != null && (
          <div
            css={(t) =>
              css({
                borderLeft: "0.5rem solid",
                borderColor: t.colors.borderLight,
                paddingLeft: "1.5rem",
                marginBottom: "2rem",
              })
            }
          >
            {message.repliedMessage.stringContent}
          </div>
        )}
        {message?.stringContent || "..."}
      </div>
      <div css={css({ paddingBottom: "1rem" })}>
        {me.id !== message.authorUserId ? (
          <>Draft to {message?.author?.displayName}</>
        ) : (
          "Draft reply"
        )}
      </div>
      <textarea
        placeholder={
          me.id === message.authorUserId
            ? "Type your message"
            : "Type your reply..."
        }
        rows={2}
        value={replyContent}
        onChange={(e) => setReplyContent(e.target.value)}
        disabled={hasPendingSubmit}
        css={(t) =>
          css({
            background: "none",
            border: 0,
            width: "100%",
            outline: "none",
            color: t.colors.textNormal,
            fontSize: t.fontSizes.large,
            padding: "1rem 0",
            resize: "none",
            "::placeholder": { color: t.colors.textMuted },
          })
        }
      />
      <div css={css({ paddingTop: "2rem" })}>
        <Button
          variant="primary"
          type="submit"
          isLoading={hasPendingSubmit}
          disabled={hasPendingSubmit}
        >
          {isLastMessage ? "Send message" : "Send reply"}
        </Button>
      </div>
    </form>
  );
};

const MessageItem = ({ id, onClick }) => {
  const message = useMessage(id);
  console.log(message);

  return (
    <button
      onClick={onClick}
      css={() => {
        const hoverColor = "hsl(0 100% 100% / 2%)";
        return css({
          display: "block",
          width: "100%",
          color: "inherit",
          textDecoration: "none",
          padding: "1.5rem 2rem",
          ":hover": {
            background: `linear-gradient(90deg, transparent 0%, ${hoverColor} 20%, ${hoverColor} 80%, transparent 100%)`,
          },
          "@media (min-width: 600px)": {
            padding: "1.5rem 4rem",
          },
        });
      }}
    >
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          alignItems: "center",
          gridGap: "2rem",
          ".sender": { display: "none" },
          "@media (min-width: 600px)": {
            gridTemplateColumns: "13rem minmax(0,1fr) auto",
            ".sender": { display: "flex" },
          },
        })}
      >
        <div className="sender" css={css({ alignItems: "center" })}>
          <UserAvatar
            walletAddress={message.author?.walletAddress}
            size="2.6rem"
            background={theme.colors.backgroundTertiary}
          />
          <div
            css={(t) =>
              css({
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
                minWidth: 0,
                fontSize: t.fontSizes.large,
                color: t.colors.textDimmed,
                marginLeft: "1rem",
              })
            }
          >
            {message.author?.displayName}
          </div>
        </div>
        <div
          css={(t) =>
            css({
              fontSize: t.fontSizes.large,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: t.colors.textDimmed,
            })
          }
        >
          {message?.stringContent || "..."}
        </div>
        <div
          css={(t) =>
            css({ fontSize: t.fontSizes.small, color: t.colors.textMuted })
          }
        >
          {message &&
            (isToday(new Date(message.createdAt)) ? (
              <FormattedDate
                value={new Date(message.createdAt)}
                hour="numeric"
                minute="numeric"
              />
            ) : isYesterday(new Date(message.createdAt)) ? (
              "Yesterday"
            ) : (
              <FormattedDate
                value={new Date(message.createdAt)}
                month="short"
                day="numeric"
              />
            ))}
        </div>
      </div>
    </button>
  );
};

export default Channel;
