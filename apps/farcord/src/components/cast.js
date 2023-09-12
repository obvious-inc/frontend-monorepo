import { css } from "@emotion/react";
import { isToday, isYesterday, parseISO } from "date-fns";
import FormattedDate from "./formatted-date";
import React, { useEffect } from "react";
import Avatar from "@shades/ui-web/avatar";
import { Link } from "react-router-dom";
import { REACTION_TYPE, addReaction, removeReaction } from "../hooks/hub";
import useSigner from "./signer";
import {
  Retweet as RetweetIcon,
  Heart as HeartRegularIcon,
  HeartSolid as HeartSolidIcon,
  ChatBubble as ChatBubbleIcon,
} from "@shades/ui-web/icons";
import { array as arrayUtils } from "@shades/common/utils";
import RichText from "./rich-text";

const IMAGE_ENDINGS = ["jpg", "jpeg", "png", "gif", "webp", "svg"];

export const CastAuthor = ({ cast }) => {
  const author = cast.author;
  const warpcastAuthorLink = `https://warpcast.com/${author.username}`;

  return (
    <>
      <p
        css={(t) =>
          css({
            fontWeight: t.text.weights.emphasis,
          })
        }
      >
        {author.display_name || author.displayName}
      </p>
      <a
        href={warpcastAuthorLink}
        target="_blank"
        rel="noreferrer"
        css={(t) =>
          css({
            color: t.colors.textMuted,
            textDecoration: "none",
          })
        }
      >
        (@{author.username})
      </a>
    </>
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

const CastDate = ({ date }) => {
  return (
    <TinyMutedText style={{ lineHeight: 1.5 }}>
      [
      {isToday(date) ? (
        <FormattedDate value={date} hour="numeric" minute="numeric" />
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
      ]
    </TinyMutedText>
  );
};

export const CastHeader = ({ cast }) => {
  const replyCount = cast.replies.count;

  const { fid, signer } = useSigner();
  const [liked, setLiked] = React.useState(false);
  const [recasted, setRecasted] = React.useState(false);
  const [likesCount, setLikesCount] = React.useState(0);
  const [recastsCount, setRecastsCount] = React.useState(0);

  React.useEffect(() => {
    if (!fid) return;

    let uniqueLikes = [];
    let uniqueRecasts = [];

    // v1 Vs. v2 neynar apis...
    if ("recasts" in cast) {
      uniqueLikes = arrayUtils.unique(cast.reactions?.fids || []);
      uniqueRecasts = arrayUtils.unique(cast.recasts?.fids || []);
    } else {
      uniqueLikes = arrayUtils.unique(
        cast.reactions?.likes.map((r) => r.fid) || []
      );
      uniqueRecasts = arrayUtils.unique(
        cast.reactions?.recasts.map((r) => r.fid) || []
      );
    }

    setLiked(uniqueLikes.includes(Number(fid)));
    setLikesCount(uniqueLikes.length);
    setRecasted(uniqueRecasts.includes(Number(fid)));
    setRecastsCount(uniqueRecasts.length);
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
      <CastAuthor cast={cast} />

      <Link
        to={`?cast=${cast.hash}`}
        css={css({
          color: "inherit",
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
        })}
      >
        <CastDate date={parseISO(cast.timestamp)} />
      </Link>

      <>
        <Link
          to={`?cast=${cast.hash}`}
          css={css({
            cursor: "pointer",
            textDecoration: "none",
            color: "inherit",
          })}
        >
          <ChatBubbleIcon css={css({ width: "auto", height: "1.6rem" })} />
        </Link>
        <TinyMutedText style={{ lineHeight: 1.5 }}>{replyCount}</TinyMutedText>
      </>

      <>
        <button css={css({ cursor: "pointer" })} onClick={handleLikeClick}>
          {liked ? (
            <HeartSolidIcon css={css({ width: "auto", height: "1.6rem" })} />
          ) : (
            <HeartRegularIcon css={css({ width: "auto", height: "1.6rem" })} />
          )}
        </button>
        <TinyMutedText style={{ lineHeight: 1.5 }}>{likesCount}</TinyMutedText>
      </>

      <>
        <button css={css({ cursor: "pointer" })} onClick={handleRecastClick}>
          {recasted ? (
            <RetweetIcon
              css={css({ width: "auto", height: "1.6rem", fill: "green" })}
            />
          ) : (
            <RetweetIcon css={css({ width: "auto", height: "1.6rem" })} />
          )}
        </button>
        <TinyMutedText style={{ lineHeight: 1.5 }}>
          {recastsCount}
        </TinyMutedText>
      </>
    </div>
  );
};

const Embed = ({ embed }) => {
  const [isImage, setIsImage] = React.useState(false);

  useEffect(() => {
    return () => {
      if (IMAGE_ENDINGS.some((ending) => embed.url.endsWith(ending))) {
        setIsImage(true);
      }
    };
  }, [embed]);

  if (isImage)
    return (
      <div
        css={css({
          padding: "1rem 0 1rem 0",
        })}
      >
        <img
          css={css({ borderRadius: "0.5rem", width: "auto", height: "25rem" })}
          src={embed.url}
          loading="lazy"
          height="25rem"
        />
      </div>
    );

  return null;
};

const CastEmbeds = ({ cast }) => {
  if (!cast.embeds?.length) return null;
  return (
    <div>
      {cast.embeds.map((embed, i) => (
        <div key={i}>
          <Embed embed={embed} />
        </div>
      ))}
    </div>
  );
};

export const CastItem = ({ cast, horizontalPadding = "1.6rem" }) => {
  const containerRef = React.useRef();

  return (
    <div
      ref={containerRef}
      role="listitem"
      data-message-id={cast.hash}
      style={{
        "--padding": `0.7rem ${horizontalPadding} 0.3rem`,
      }}
      className="channel-message-container"
    >
      <div
        className="main-container"
        style={{
          gridTemplateColumns: "var(--avatar-size) minmax(0,1fr)",
          gridGap: "var(--gutter-size)",
        }}
      >
        <Avatar
          url={cast.author.pfp_url || cast.author.pfp.url}
          size="var(--avatar-size)"
        />
        <div
          style={{
            display: "block",
            flexDirection: "column",
          }}
        >
          <CastHeader cast={cast} />
          <>
            <CastBody cast={cast} />
            <CastEmbeds cast={cast} />
          </>
        </div>
      </div>
    </div>
  );
};
