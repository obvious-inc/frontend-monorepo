import { css, useTheme } from "@emotion/react";
import { isToday, isYesterday, parseISO } from "date-fns";
import FormattedDate from "./formatted-date";
import React, { useEffect } from "react";
import Avatar from "@shades/ui-web/avatar";
import { Link } from "react-router-dom";

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
      <>
        <CastAuthor cast={cast} />

        <CastDate date={parseISO(cast.timestamp)} />

        {replyCount > 0 && (
          <TinyMutedText style={{ lineHeight: 1.5 }}>
            {replyCount == 1 ? "1 reply" : `${replyCount} replies`}
          </TinyMutedText>
        )}
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
          maxWidth: "25rem",
        })}
      >
        <img
          css={css({ borderRadius: "0.5rem" })}
          src={embed.url}
          loading="lazy"
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
  const theme = useTheme();

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
            <Link
              component="div"
              to={`/casts/${cast.hash}`}
              key={cast.hash}
              css={css({
                color: "inherit",
                textDecoration: "none",
              })}
            >
              <CastBody cast={cast} />
            </Link>
            <CastEmbeds cast={cast} />
          </>
        </div>
      </div>
    </div>
  );
};
