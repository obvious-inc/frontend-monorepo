import { css } from "@emotion/react";
import { isToday, isYesterday, parseISO } from "date-fns";
import FormattedDate from "./formatted-date";
import React, { Suspense, useEffect } from "react";
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
import { array as arrayUtils } from "@shades/common/utils";
import RichText from "./rich-text";
import useFarcasterAccount from "./farcaster-account";
import { useFarcasterChannelByUrl } from "../hooks/farcord";
import { parseChannelFromUrl } from "../utils/channel";
import { useNeynarCast } from "../hooks/neynar";
import AppTag from "./app-tag";
import TinyMutedText from "./tiny-muted-text";

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

const CastDate = ({ date }) => {
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
  const replyCount = cast.replies.count;

  const { fid } = useFarcasterAccount();
  const { signer, broadcasted } = useSigner();
  const [liked, setLiked] = React.useState(false);
  const [recasted, setRecasted] = React.useState(false);
  const [likesCount, setLikesCount] = React.useState(0);
  const [recastsCount, setRecastsCount] = React.useState(0);

  const [searchParams] = useSearchParams();

  const renderSignerInfo = () => {
    if (searchParams.get("dev") || process.env.NODE_ENV === "development") {
      return (
        <>
          <Suspense>
            <AppTag cast={cast} fid={cast.author.fid} hash={cast.hash} />
          </Suspense>
        </>
      );
    }
  };

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

      <div
        css={() =>
          css({
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(0, auto)",
            alignSelf: "flex-end",
            justifyContent: "flex-start",
            alignItems: "flex-end",
            gridGap: "0.6rem",
            // cursor: broadcasted ? "default" : "not-allowed",
          })
        }
      >
        <>
          <Link
            to={`?cast=${cast.hash}`}
            css={css({
              cursor: "pointer",
              textDecoration: "none",
              color: "inherit",
            })}
          >
            <CommentIcon css={css({ width: "auto", height: "1.6rem" })} />
          </Link>
          <TinyMutedText style={{ lineHeight: 1.5 }}>
            {replyCount}
          </TinyMutedText>
        </>

        <>
          <button
            css={css({ cursor: broadcasted ? "pointer" : "not-allowed" })}
            onClick={handleLikeClick}
            disabled={!broadcasted}
          >
            {liked ? (
              <HeartSolidIcon
                css={css({
                  width: "auto",
                  height: "1.6rem",
                  fill: "rgb(213, 19, 56)",
                })}
              />
            ) : (
              <HeartRegularIcon
                css={css({ width: "auto", height: "1.6rem" })}
              />
            )}
          </button>
          <TinyMutedText style={{ lineHeight: 1.5 }}>
            {likesCount}
          </TinyMutedText>
        </>

        <>
          <button
            css={css({ cursor: broadcasted ? "pointer" : "not-allowed" })}
            onClick={handleRecastClick}
            disabled={!broadcasted}
          >
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

        <>{renderSignerInfo()}</>
      </div>
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
      <a
        href={embed.url}
        target="_blank"
        rel="noreferrer"
        css={css({
          display: "block",
          padding: "1rem 0 1rem 0",
          maxWidth: "40rem",
          height: "auto",
          img: {
            maxWidth: "40rem",
            maxHeight: "30rem",
            height: "auto",
            borderRadius: "0.3rem",
          },
        })}
      >
        <img src={embed.url} loading="lazy" />
      </a>
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
    <div css={css({ padding: "2rem 0" })}>
      <Link
        to={channelLink}
        css={(t) =>
          css({
            cursor: "pointer",
            textDecoration: "none",
            color: t.colors.pink,
            border: "1px dashed",
            padding: "0.5rem 2rem",
            borderColor: t.colors.borderLight,
          })
        }
      >
        {parsedChannel?.name || truncatedParentUrl}
      </Link>
    </div>
  );
};

const ReplyTargetCast = ({ castHash, layout, onClickMessage }) => {
  const cast = useNeynarCast(castHash);

  return (
    <div
      css={(t) =>
        css({
          position: "relative",
          ":before": {
            display: "var(--path-display)",
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
      style={{
        "--path-display": layout === "bubbles" ? "none" : "block",
        paddingLeft: layout !== "bubbles" ? "5rem" : undefined,
        marginBottom: layout === "bubbles" ? 0 : "0.5rem",
      }}
    >
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "1.4rem minmax(0,1fr)",
          alignItems: "center",
          gridGap: "0.5rem",
        })}
      >
        <Avatar
          url={cast?.author?.pfp_url || cast?.author?.pfp.url}
          size="1.4rem"
        />
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
          <>
            {cast?.author?.display_name || cast?.author?.displayName}
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
              <RichText inline blocks={cast?.richText ?? []} />
            </span>
          </>
        </div>
      </div>
    </div>
  );
};

export const CastItem = ({
  cast,
  isFeed,
  isRecent,
  showReplies = false,
  horizontalPadding = "1.6rem",
}) => {
  const navigate = useNavigate();
  const containerRef = React.useRef();

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
      }}
      className="channel-message-container"
    >
      {showReplies && replyTargetCastElement}
      <div
        className="main-container"
        style={{
          gridTemplateColumns: "var(--avatar-size) minmax(0,1fr)",
          gridGap: "var(--gutter-size)",
        }}
      >
        <Avatar
          url={cast.author?.pfp_url || cast.author?.pfp?.url}
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
            {(isFeed || isRecent) && <CastChannel cast={cast} />}
          </>
        </div>
      </div>
    </div>
  );
};
