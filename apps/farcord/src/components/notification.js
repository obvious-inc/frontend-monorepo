import React from "react";
import { css } from "@emotion/react";
import ReplyTargetCast from "./reply-target-cast";
import { Link, useNavigate } from "react-router-dom";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger";
import Avatar from "@shades/ui-web/avatar";
import { CastDate } from "./cast";
import { parseISO } from "date-fns";
import {
  Retweet as RetweetIcon,
  HeartSolid as HeartSolidIcon,
} from "@shades/ui-web/icons";

const NotificationBody = ({ notification }) => {
  if (notification == null) return null;

  return (
    <p style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
      {notification.text}
    </p>
  );
};

const MentionNotification = ({ notification, showReplyTarget = false }) => {
  const navigate = useNavigate();
  const author = notification.author;

  return (
    <>
      {showReplyTarget && (
        <ReplyTargetCast
          castHash={notification.parentHash}
          onClickMessage={() => {
            navigate(`?cast=${notification.parentHash}`);
          }}
        />
      )}
      <div
        className="main-container"
        style={{
          display: "grid",
          gridTemplateColumns: "var(--avatar-size) minmax(0,1fr)",
          gridGap: "var(--gutter-size)",
        }}
      >
        <Avatar
          url={notification.author?.pfp_url || notification.author?.pfp?.url}
          size="var(--avatar-size)"
        />
        <div>
          <div
            css={css`
              display: grid;
              grid-auto-flow: column;
              grid-auto-columns: minmax(0, auto);
              justify-content: flex-start;
              align-items: center;
              grid-gap: 0.6rem;
              margin: 0 0 0.2rem;
              cursor: default;
              min-height: 1.9rem;
              line-height: 1.2;
            `}
          >
            <p
              css={(t) =>
                css({
                  fontWeight: t.text.weights.emphasis,
                })
              }
            >
              {author.display_name || author.displayName}
            </p>
            <AccountPreviewPopoverTrigger
              fid={author.fid}
              css={(t) => css({ color: t.colors.textMuted })}
            />

            <Link
              to={`?cast=${notification.hash}`}
              css={(t) =>
                css({
                  color: "inherit",
                  textDecoration: "none",
                  ":focus-visible": {
                    color: t.colors.textMutedModifierHover,
                  },
                  "@media(hover: hover)": {
                    cursor: "pointer",
                    ":hover": {
                      color: t.colors.textMutedModifierHover,
                    },
                  },
                })
              }
            >
              <CastDate date={parseISO(notification.timestamp)} />
            </Link>
          </div>
          <NotificationBody notification={notification} />
        </div>
      </div>
    </>
  );
};

const LikeNotification = ({ notification }) => {
  const reactors = notification.reactors;

  const likedText = () => {
    const reactor = reactors[0];
    if (reactors.length === 1) {
      return `${reactor.displayName} liked your cast`;
    } else if (reactors.length === 2) {
      return `${reactor.displayName} and 1 other liked your cast`;
    } else {
      return `${reactor.displayName} and ${
        reactors.length - 1
      } others liked your cast`;
    }
  };

  return (
    <div
      className="main-container"
      style={{
        display: "grid",
        gridTemplateColumns: "var(--avatar-size) minmax(0,1fr)",
        gridGap: "var(--gutter-size)",
      }}
    >
      <HeartSolidIcon
        css={css({
          width: "var(--avatar-size)",
          fill: "rgb(255, 93, 103)",
        })}
      />
      <div>
        <div
          css={css`
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: minmax(0, auto);
            justify-content: flex-start;
            align-items: center;
            grid-gap: 0.6rem;
            margin: 0 0 0.2rem;
            cursor: default;
            min-height: 1.9rem;
            line-height: 1.2;
          `}
        >
          {reactors.slice(0, 8).map((reactor) => (
            <Avatar
              key={reactor.fid}
              url={reactor.pfp_url || reactor.pfp?.url}
              size="3rem"
            />
          ))}
        </div>
        {likedText()}
        <Link
          to={`?cast=${notification.hash}`}
          css={(t) =>
            css({
              color: t.colors.textMuted,
              textDecoration: "none",
              ":focus-visible": {
                color: t.colors.textMutedModifierHover,
              },
              "@media(hover: hover)": {
                cursor: "pointer",
                ":hover": {
                  color: t.colors.textMutedModifierHover,
                },
              },
            })
          }
        >
          <NotificationBody notification={notification} />
        </Link>
      </div>
    </div>
  );
};

const RecastNotification = ({ notification }) => {
  const reactors = notification.reactors;

  const recastText = () => {
    const reactor = reactors[0];
    if (reactors.length === 1) {
      return `${reactor.displayName} recasted your cast`;
    } else if (reactors.length === 2) {
      return `${reactor.displayName} and 1 other recasted`;
    } else {
      return `${reactor.displayName} and ${
        reactors.length - 1
      } others recasted`;
    }
  };

  return (
    <div
      className="main-container"
      style={{
        display: "grid",
        gridTemplateColumns: "var(--avatar-size) minmax(0,1fr)",
        gridGap: "var(--gutter-size)",
      }}
    >
      <RetweetIcon
        css={css({
          width: "var(--avatar-size)",
          fill: "rgb(0, 186, 124)",
        })}
      />
      <div>
        <div
          css={css`
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: minmax(0, auto);
            justify-content: flex-start;
            align-items: center;
            grid-gap: 0.6rem;
            margin: 0 0 0.2rem;
            cursor: default;
            min-height: 1.9rem;
            line-height: 1.2;
          `}
        >
          {reactors.slice(0, 8).map((reactor) => (
            <Avatar
              key={reactor.fid}
              url={reactor.pfp_url || reactor.pfp?.url}
              size="3rem"
            />
          ))}
        </div>
        {recastText()}
        <Link
          to={`?cast=${notification.hash}`}
          css={(t) =>
            css({
              color: t.colors.textMuted,
              textDecoration: "none",
              ":focus-visible": {
                color: t.colors.textMutedModifierHover,
              },
              "@media(hover: hover)": {
                cursor: "pointer",
                ":hover": {
                  color: t.colors.textMutedModifierHover,
                },
              },
            })
          }
        >
          <NotificationBody notification={notification} />
        </Link>
      </div>
    </div>
  );
};

const NotificationItem = ({ notification, unseen = false }) => {
  const containerRef = React.useRef();

  const notificationType = notification?.type;
  const notificationItem = React.useMemo(() => {
    switch (notificationType) {
      case "cast-reply": {
        return (
          <MentionNotification
            notification={notification}
            showReplyTarget={true}
          />
        );
      }
      case "cast-mention": {
        return (
          <MentionNotification
            notification={notification}
            showReplyTarget={false}
          />
        );
      }
      case "like": {
        return <LikeNotification notification={notification} />;
      }
      case "recast": {
        return <RecastNotification notification={notification} />;
      }
      default: {
        console.error("Unknown notification type", notification);
        return <div>Unknown</div>;
      }
    }
  }, [notificationType, notification]);

  return (
    <div
      ref={containerRef}
      role="listitem"
      data-message-id={notification.hash}
      css={(t) =>
        css({
          "--padding": `2rem 1.6rem 1rem`,
          borderBottom: `0.1rem dashed ${t.colors.borderLighter}`,
          background: unseen
            ? `${t.colors.backgroundTertiary} !important`
            : "inherit",
        })
      }
      className="channel-message-container"
    >
      {notificationItem}
    </div>
  );
};

export default NotificationItem;
