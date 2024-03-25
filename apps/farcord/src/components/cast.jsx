import { css } from "@emotion/react";
import { isToday, isYesterday, parseISO } from "date-fns";
import FormattedDate from "./formatted-date";
import React, { Suspense } from "react";
import Avatar from "@shades/ui-web/avatar";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { REACTION_TYPE, addReaction, removeReaction } from "../hooks/hub";
import useSigner from "./signer";
import {
  Comment as CommentIcon,
  Retweet as RetweetIcon,
  Heart as HeartRegularIcon,
  HeartSolid as HeartSolidIcon,
} from "@shades/ui-web/icons";
import RichText from "./rich-text";
import useFarcasterAccount from "./farcaster-account";
import { useFarcasterChannelByUrl } from "../hooks/farcord";
import { parseChannelFromUrl } from "../utils/channel";
import AppTag from "./app-tag";
import TinyMutedText from "./tiny-muted-text";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger";
import { NewCastsMarker } from "./new-casts-marker";
import ReplyTargetCast from "./reply-target-cast";
import { useMatchMedia } from "@shades/common/react";

const IMAGE_ENDINGS = ["jpg", "jpeg", "png", "gif", "webp", "svg"];

export const CastAuthor = ({ cast }) => {
  const author = cast.author;
  const displayName = author.display_name ?? author.displayName;

  return (
    <AccountPreviewPopoverTrigger fid={author.fid}>
      <button
        css={(t) =>
          css({
            outline: "none",
            color: t.colors.textDimmed,
            "[data-display-name]": {
              color: t.colors.textNormal,
              fontWeight: t.text.weights.emphasis,
            },
            "@media(hover: hover)": {
              cursor: "pointer",
              ":hover [data-display-name]": { textDecoration: "underline" },
              ":hover [data-username]": {
                color: t.colors.textDimmedModifierHover,
              },
            },
          })
        }
      >
        {displayName != null ? (
          <>
            <span data-display-name>{displayName}</span>{" "}
            <span data-username>@{author.username}</span>
          </>
        ) : (
          <span data-display-name>{author.username}</span>
        )}
      </button>
    </AccountPreviewPopoverTrigger>
  );
};

const CastBody = ({ cast }) => {
  if (cast == null) return null;
  if (cast.richText) return <RichText blocks={cast.richText} />;

  return (
    <p style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
      {cast.text}
    </p>
  );
};

export const CastDate = ({ date }) => {
  return (
    <TinyMutedText style={{ lineHeight: 1.5 }}>
      {isToday(date) ? (
        <>
          Today at{" "}
          <FormattedDate value={date} hour="numeric" minute="numeric" />
        </>
      ) : isYesterday(date) ? (
        <>
          Yesterday at{" "}
          <FormattedDate value={date} hour="numeric" minute="numeric" />
        </>
      ) : (
        <FormattedDate
          value={date}
          month="short"
          day="numeric"
          hour="numeric"
          minute="numeric"
        />
      )}
    </TinyMutedText>
  );
};

export const CastHeader = ({ cast }) => {
  const [searchParams] = useSearchParams();

  const renderSignerInfo = () => {
    if (searchParams.get("dev")) {
      return (
        <Suspense>
          <AppTag cast={cast} fid={cast.author.fid} hash={cast.hash} />
        </Suspense>
      );
    }
  };

  return (
    <div
      css={css`
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, auto);
        justify-content: flex-start;
        align-items: flex-end;
        grid-gap: 0.6rem;
        margin: 0 0 0.3rem;
        cursor: default;
        min-height: 1.9rem;
        line-height: 1.2;
      `}
    >
      <CastAuthor cast={cast} />

      <Link
        to={`?cast=${cast.hash}`}
        css={(t) =>
          css({
            color: t.colors.textDimmed,
            textDecoration: "none",
            ":focus-visible": {
              textDecoration: "underline",
            },
            "@media(hover: hover)": {
              cursor: "pointer",
              ":hover": {
                textDecoration: "underline",
              },
            },
          })
        }
      >
        <CastDate date={parseISO(cast.timestamp)} />
      </Link>

      <>{renderSignerInfo()}</>
    </div>
  );
};

const Embed = ({ embed, text }) => {
  let embedType = "url";

  if (IMAGE_ENDINGS.some((ending) => embed.url?.endsWith(ending))) {
    embedType = "image";
  } else if (embed.url?.endsWith("mp4")) {
    embedType = "video";
  }

  // todo: not sure how to handle cast id embeds for now
  if (!embed.url) return <div></div>;

  if (embed.url && embedType == "url" && text.includes(embed?.url)) return null;

  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noreferrer"
      css={(t) =>
        css({
          display: "block",
          padding: "1rem 0 1rem 0",
          maxWidth: "40rem",
          height: "auto",
          color: t.colors.link,
          textDecoration: "none",
          ":hover": { color: t.colors.linkModifierHover },
          img: {
            maxWidth: "40rem",
            maxHeight: "30rem",
            height: "auto",
            borderRadius: "0.3rem",
          },
        })
      }
    >
      {embedType === "image" ? (
        <img src={embed.url} loading="lazy" />
      ) : embedType === "video" ? (
        <video
          controls
          playsInline
          src={embed.url}
          css={css({
            display: "block",
            marginTop: "0.8rem",
            borderRadius: "0.3rem",
            objectFit: "cover",
            maxWidth: "100%",
            height: 260,
            width: "auto",
          })}
        />
      ) : (
        <p>{embed.url}</p>
      )}
    </a>
  );
};

const CastEmbeds = ({ cast }) => {
  if (!cast.embeds?.length) return null;
  return (
    <div>
      {cast.embeds.map((embed, i) => (
        <div key={i}>
          <Embed embed={embed} text={cast.text} />
        </div>
      ))}
    </div>
  );
};

const CastChannel = ({ cast }) => {
  const parentUrl = cast.parentUrl || cast.parent_url;
  const warpcastChannel = useFarcasterChannelByUrl(parentUrl);

  if (!parentUrl) return;

  const parsedChannel = warpcastChannel ?? parseChannelFromUrl(parentUrl);

  const channelLink = `/channels/${
    parsedChannel?.id || encodeURIComponent(parsedChannel.url)
  }`;

  const SLICE_LENGTH = 80;
  const truncate = parentUrl > SLICE_LENGTH;
  const truncatedParentUrl = truncate
    ? parentUrl.slice(0, SLICE_LENGTH) + "..."
    : parentUrl;

  return (
    <div css={css({ marginTop: "0.7rem" })}>
      <Link
        to={channelLink}
        css={(t) =>
          css({
            fontSize: t.text.sizes.small,
            textDecoration: "none",
            color: t.colors.textDimmed,
            border: "0.1rem solid",
            borderColor: t.colors.borderLighter,
            padding: "0.3rem 0.5rem",
            borderRadius: "0.3rem",
            background: t.colors.backgroundModifierNormal,
            "@media(hover: hover)": {
              ":hover": {
                background: t.colors.backgroundModifierStrong,
              },
            },
          })
        }
      >
        {parsedChannel?.name || truncatedParentUrl}
      </Link>
    </div>
  );
};

const CastActions = ({ cast }) => {
  const replyCount = cast.replies.count;

  const { fid } = useFarcasterAccount();
  const { signer, broadcasted } = useSigner();
  const [liked, setLiked] = React.useState(false);
  const [recasted, setRecasted] = React.useState(false);
  const [likesCount, setLikesCount] = React.useState(0);
  const [recastsCount, setRecastsCount] = React.useState(0);

  React.useEffect(() => {
    if (!fid) return;

    setLiked(cast.reactions.likes.includes(Number(fid)));
    setLikesCount(cast.reactions.likes.length);
    setRecasted(cast.reactions.recasts.includes(Number(fid)));
    setRecastsCount(cast.reactions.recasts.length);
  }, [cast, fid]);

  const handleLikeClick = async () => {
    if (liked) {
      removeReaction({
        fid,
        signer,
        cast: { fid: cast.author.fid, hash: cast.hash },
        reactionType: REACTION_TYPE.LIKE,
      }).then(() => {
        setLiked(false);
        setLikesCount(likesCount - 1);
      });
    } else {
      addReaction({
        fid,
        signer,
        cast: { fid: cast.author.fid, hash: cast.hash },
        reactionType: REACTION_TYPE.LIKE,
      }).then(() => {
        setLiked(true);
        setLikesCount(likesCount + 1);
      });
    }
  };

  const handleRecastClick = async () => {
    if (recasted) {
      removeReaction({
        fid,
        signer,
        cast: { fid: cast.author.fid, hash: cast.hash },
        reactionType: REACTION_TYPE.RECAST,
      }).then(() => {
        setRecasted(false);
        setRecastsCount(recastsCount - 1);
      });
    } else {
      addReaction({
        fid,
        signer,
        cast: { fid: cast.author.fid, hash: cast.hash },
        reactionType: REACTION_TYPE.RECAST,
      }).then(() => {
        setRecasted(true);
        setRecastsCount(recastsCount + 1);
      });
    }
  };

  return (
    <div
      css={(t) =>
        css({
          padding: "0 0.2rem",
          display: "flex",
          alignItems: "center",
          gap: "1.6rem",
          fontSize: t.text.sizes.small,
          color: t.colors.textDimmed,
          marginTop: "0.7rem",
          "[data-item]": {
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            "@media(hover: hover)": {
              cursor: "pointer",
              ":not(:disabled):hover": {
                color: t.colors.textNormal,
              },
            },
          },
          "[data-icon]": {
            width: "1.5rem",
            height: "auto",
          },
        })
      }
    >
      <Link
        data-item
        to={`?cast=${cast.hash}`}
        css={css({ textDecoration: "none", color: "inherit" })}
      >
        <CommentIcon data-icon />
        {replyCount > 0 && <span data-count>{replyCount}</span>}
      </Link>

      <button
        data-item
        css={css({
          color: recasted ? "rgb(0, 186, 124)" : undefined,
          cursor: broadcasted ? "pointer" : "not-allowed",
        })}
        onClick={handleRecastClick}
        disabled={!broadcasted}
      >
        {recasted ? <RetweetIcon data-icon /> : <RetweetIcon data-icon />}
        {recastsCount > 0 && <span data-count>{recastsCount}</span>}
      </button>

      <button
        data-item
        css={css({
          cursor: broadcasted ? "pointer" : "not-allowed",
          color: liked ? "rgb(255, 93, 103)" : undefined,
        })}
        onClick={handleLikeClick}
        disabled={!broadcasted}
      >
        {liked ? <HeartSolidIcon data-icon /> : <HeartRegularIcon data-icon />}
        {likesCount > 0 && <span data-count>{likesCount}</span>}
      </button>
    </div>
  );
};

export const CastItem = ({
  cast,
  isFeed,
  isRecent,
  showReplies = false,
  horizontalPadding = "1.6rem",
  showLastReadMark = false,
}) => {
  const navigate = useNavigate();
  const containerRef = React.useRef();
  const isSmallScreen = useMatchMedia("(max-width: 800px)");

  const replyTargetCastElement = showReplies && cast.parentHash && (
    <ReplyTargetCast
      castHash={cast.parentHash}
      onClickMessage={() => {
        navigate(`?cast=${cast.parentHash}`);
      }}
    />
  );

  return (
    <div
      ref={containerRef}
      role="listitem"
      data-message-id={cast.hash}
      style={{
        "--padding": `0.7rem ${horizontalPadding} 0.3rem`,
        marginTop: "1.5rem",
      }}
      className="channel-message-container"
    >
      {showReplies && replyTargetCastElement}
      <div
        className="main-container"
        css={(t) =>
          css({
            gridTemplateColumns: "var(--avatar-size) minmax(0,1fr)",
            gridGap: "var(--gutter-size)",
            fontSize: isSmallScreen ? t.text.sizes.base : "inherit",
          })
        }
      >
        <div style={{ padding: "0.3rem 0 0" }}>
          <Avatar url={cast.author?.pfpUrl} size="var(--avatar-size)" />
        </div>
        <div>
          <CastHeader cast={cast} />
          <CastBody cast={cast} />
          <CastEmbeds cast={cast} />
          <CastActions cast={cast} />
          {(isFeed || isRecent) && <CastChannel cast={cast} />}
        </div>
      </div>
      {showLastReadMark && <NewCastsMarker />}
    </div>
  );
};
