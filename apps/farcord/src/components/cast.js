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
import { array as arrayUtils } from "@shades/common/utils";
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
      <AccountPreviewPopoverTrigger
        fid={author.fid}
        css={(t) => css({ color: t.colors.textMuted })}
      />
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
  const replyCount = cast.replies.count;

  const { fid } = useFarcasterAccount();
  const { signer, broadcasted } = useSigner();
  const [liked, setLiked] = React.useState(false);
  const [recasted, setRecasted] = React.useState(false);
  const [likesCount, setLikesCount] = React.useState(0);
  const [recastsCount, setRecastsCount] = React.useState(0);

  const [searchParams] = useSearchParams();

  const renderSignerInfo = () => {
    if (searchParams.get("dev")) {
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
                  fill: "rgb(255, 93, 103)",
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
                css={css({
                  width: "auto",
                  height: "1.6rem",
                  fill: "rgb(0, 186, 124)",
                })}
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
        <Avatar url={cast.author?.pfpUrl} size="var(--avatar-size)" />
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
      {showLastReadMark && <NewCastsMarker />}
    </div>
  );
};
