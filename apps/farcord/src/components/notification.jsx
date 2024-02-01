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
import RichText from "./rich-text";

const NotificationBody = ({ notification, displayRichText = false }) => {
  if (notification == null) return null;
  const cast = notification.cast;
  if (cast.richText && displayRichText)
    return <RichText blocks={cast.richText} />;

  return (
    <p style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
      {cast.text}
    </p>
  );
};

const MentionNotification = ({ notification, showReplyTarget = false }) => {
  const navigate = useNavigate();
  const cast = notification.cast;
  const author = cast.author;

  return (
    <>
      {showReplyTarget && (
        <ReplyTargetCast
          castHash={cast.parentHash}
          onClickMessage={() => {
            navigate(`?cast=${cast.parentHash}`);
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
        <Avatar url={cast.author?.pfpUrl} size="var(--avatar-size)" />
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
              to={`?cast=${cast.hash}`}
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
              <CastDate date={parseISO(cast.timestamp)} />
            </Link>
          </div>
          <NotificationBody
            notification={notification}
            displayRichText={true}
          />
        </div>
      </div>
    </>
  );
};

const LikeNotification = ({ notification }) => {
  const reactions = notification.reactions;
  const reactors = reactions.map((r) => r.user);
  const cast = notification.cast;

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
              key={`${notification.id}-${reactor.fid}`}
              url={reactor.pfpUrl}
              size="3rem"
            />
          ))}
        </div>
        {likedText()}
        <Link
          to={`?cast=${cast.hash}`}
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
  const reactions = notification.reactions;
  const reactors = reactions.map((r) => r.user);
  const cast = notification.cast;

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
              key={`${notification.id}-${reactor.fid}`}
              url={reactor.pfpUrl}
              size="3rem"
            />
          ))}
        </div>
        {recastText()}
        <Link
          to={`?cast=${cast.hash}`}
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

const FollowsNotification = ({ notification }) => {
  const reactors = notification.follows.map((r) => r.user);

  const followText = () => {
    const reactor = reactors[0];
    if (reactors.length === 1) {
      return `${reactor.displayName} followed you`;
    } else if (reactors.length === 2) {
      return `${reactor.displayName} and 1 other followed you`;
    } else {
      return `${reactor.displayName} and ${
        reactors.length - 1
      } others followed you`;
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
              key={`${notification.id}-${reactor.fid}`}
              url={reactor.pfpUrl}
              size="3rem"
            />
          ))}
        </div>
        {followText()}
      </div>
    </div>
  );
};

const NotificationItem = ({ notification, unseen = false }) => {
  const containerRef = React.useRef();

  const notificationType = notification?.type;
  const notificationItem = React.useMemo(() => {
    switch (notificationType) {
      case "reply": {
        return (
          <MentionNotification
            notification={notification}
            showReplyTarget={true}
          />
        );
      }
      case "mention": {
        return (
          <MentionNotification
            notification={notification}
            showReplyTarget={false}
          />
        );
      }
      case "likes": {
        return <LikeNotification notification={notification} />;
      }
      case "recasts": {
        return <RecastNotification notification={notification} />;
      }
      case "follows": {
        return <FollowsNotification notification={notification} />;
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
      data-message-id={notification.id}
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
