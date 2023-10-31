import React from "react";
import { css } from "@emotion/react";
import Spinner from "@shades/ui-web/spinner";
import { CastItem } from "./cast.js";
import ThreadNavBar from "./thread-navbar.js";
import {
  useCast,
  useThreadCasts,
  useThreadCastsFetch,
} from "../hooks/channel.js";
import MetaTags_ from "./meta-tags.js";
import { useFarcasterChannelByUrl } from "../hooks/farcord.js";
import { parseChannelFromUrl } from "../utils/channel.js";
import CastInput from "./cast-input.js";

const RecursiveThreadView = ({ casts, level = 0 }) => {
  const horizontalPadding = "1.6rem";
  const leftPadding = `calc(${horizontalPadding} * ${level})`;

  return (
    <div>
      {casts.map((cast) => (
        <div key={cast.hash} css={{ paddingLeft: leftPadding }}>
          <CastItem cast={cast} />
          <div>
            {cast.children && (
              <RecursiveThreadView casts={cast.children} level={level + 1} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const ThreadCasts = ({ castHash }) => {
  const threadCasts = useThreadCasts(castHash);

  const castsWithChildren = React.useMemo(() => {
    if (!threadCasts) return null;
    if (threadCasts.length == 0) return null;

    const castsWithChildren = threadCasts.reduce((acc, cast) => {
      if (cast.parentHash == castHash) {
        acc.push(cast);
      } else {
        const parentCast = threadCasts.find((c) => c.hash == cast.parentHash);
        parentCast.children = parentCast.children || [];
        const childrenHashes = parentCast.children.map((c) => c.hash);
        if (!childrenHashes.includes(cast.hash)) parentCast.children.push(cast);
      }

      return acc;
    }, []);

    return castsWithChildren;
  }, [threadCasts, castHash]);

  if (!threadCasts)
    return (
      <div
        css={(t) =>
          css({
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: t.mainHeader.height,
          })
        }
      >
        <Spinner size="2.4rem" />
      </div>
    );

  if (threadCasts?.length == 0) return <></>;

  return <RecursiveThreadView casts={castsWithChildren} />;
};

const ThreadScrollView = ({ castHash }) => {
  const castsContainerRef = React.useRef();
  const scrollContainerRef = React.useRef();

  const cast = useCast(castHash);

  if (!cast) {
    return (
      <div
        css={(t) =>
          css({
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: t.mainHeader.height,
          })
        }
      >
        <Spinner size="2.4rem" />
      </div>
    );
  }

  return (
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
        ref={scrollContainerRef}
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
            justifyContent: "flex-start",
            alignItems: "stretch",
            minHeight: "100%",
          })}
        >
          <div
            ref={castsContainerRef}
            role="list"
            css={(t) =>
              css({
                minHeight: 0,
                fontSize: t.text.sizes.large,
                fontWeight: "400",
                "--avatar-size": t.messages.avatarSize,
                "--gutter-size": t.messages.gutterSize,
                "--gutter-size-compact": t.messages.gutterSizeCompact,
                ".channel-message-container": {
                  "--color-optimistic": t.colors.textMuted,
                  "--bg-highlight": t.colors.messageBackgroundModifierHighlight,
                  "--bg-focus": t.colors.messageBackgroundModifierFocus,
                  background: "var(--background, transparent)",
                  padding: "var(--padding)",
                  borderRadius: "var(--border-radius, 0)",
                  color: "var(--color, ${t.colors.textNormal})",
                  position: "relative",
                  lineHeight: 1.46668,
                  userSelect: "text",
                },
                ".channel-message-container .toolbar-container": {
                  position: "absolute",
                  top: 0,
                  transform: "translateY(-50%)",
                  zIndex: 1,
                },
                ".channel-message-container .main-container": {
                  display: "grid",
                  alignItems: "flex-start",
                },
              })
            }
          >
            <div>
              <CastItem cast={cast} />
            </div>
            <div
              css={(theme) =>
                css({
                  margin: "1.6rem 0",
                  borderBottomColor: theme.colors.borderLight,
                  borderBottomWidth: "1px",
                  borderBottomStyle: "dashed",
                })
              }
            />

            <ThreadCasts castHash={castHash} />
            <div css={css({ height: "1.6rem" })} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const ThreadScreen = ({ castHash }) => {
  const inputRef = React.useRef();
  const cast = useCast(castHash);

  useThreadCastsFetch({ threadCast: castHash, cursor: null });

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
          flexDirection: "column",
          height: "100%",
          borderLeftWidth: "1px",
          borderLeftStyle: "solid",
          borderLeftColor: t.colors.backgroundQuarternary,
        })
      }
    >
      <MetaTags castHash={castHash} />
      <ThreadNavBar castHash={castHash} />

      <ThreadScrollView castHash={castHash} />

      <CastInput inputRef={inputRef} threadCast={cast} />

      <div css={css({ height: "2rem" })}></div>
    </div>
  );
};

const MetaTags = ({ castHash }) => {
  const cast = useCast(castHash);

  const parentUrl = cast?.parentUrl || cast?.parent_url;
  const warpcastChannel = useFarcasterChannelByUrl(parentUrl);

  if (cast == null || cast?.deleted) return null;

  const authorName = cast.author?.display_name || cast.author?.displayName;
  const castText = cast.text;
  const title = `${authorName} on Farcord: ${castText}`;
  const description = castText.trim();

  const parsedChannel = warpcastChannel ?? parseChannelFromUrl(parentUrl);
  const channelLink = `/channels/${
    parsedChannel?.id || encodeURIComponent(parsedChannel.url)
  }`;
  const canonicalPath = parentUrl
    ? `${channelLink}?cast=${castHash}`
    : `/recent?cast=${castHash}`;

  return (
    <MetaTags_
      title={title}
      description={
        description.length > 600
          ? `${description.slice(0, 600)}...`
          : description
      }
      canonicalPathname={canonicalPath}
    />
  );
};

export default ThreadScreen;
