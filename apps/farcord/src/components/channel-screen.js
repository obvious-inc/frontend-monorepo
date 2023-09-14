import React from "react";
import { MainLayout } from "./layouts.js";
import { useParams, useSearchParams } from "react-router-dom";
import { css } from "@emotion/react";
import {
  ReverseVerticalScrollView,
  // useLatestCallback,
} from "@shades/common/react";
// import { useNeynarChannelCasts } from "../hooks/neynar.js";
import MessageEditorForm from "@shades/ui-web/message-editor-form";
import Spinner from "@shades/ui-web/spinner";
import { CastItem } from "./cast.js";
import ChannelNavBar from "./channel-navbar.js";
import { ThreadScreen } from "./cast-screen.js";
import { useFarcasterChannel } from "../hooks/farcord.js";
import { message } from "@shades/common/utils";
import useSigner from "./signer";
import { addCast } from "../hooks/hub.js";
import { useChannelCasts, useChannelCastsFetch } from "../hooks/channel.js";
// import useChannelCastsFetcher from "../hooks/channel-casts-fetcher.js";

export const ChannelCastsScrollView = ({
  channelId,
  didScrollToBottomRef: didScrollToBottomRefExternal,
}) => {
  const scrollViewRef = React.useRef();
  const castsContainerRef = React.useRef();
  const didScrollToBottomRefInternal = React.useRef();
  const disableFetchMoreRef = React.useRef();
  const didScrollToBottomRef =
    didScrollToBottomRefExternal ?? didScrollToBottomRefInternal;

  const channel = useFarcasterChannel(channelId);
  useChannelCastsFetch({ channel, cursor: null });
  const casts = useChannelCasts(channelId);

  const [pendingMessagesBeforeCount] = React.useState(0);
  const [averageMessageListItemHeight] = React.useState(0);

  const castHashes = casts?.map((cast) => cast.hash) ?? [];
  const hasAllCasts = false;

  // const fetchMessages = useChannelCastsFetcher(channelId);

  // const fetchMoreCasts = useLatestCallback(async (query) => {
  //   const count = 30;
  //   setPendingMessagesBeforeCount(count);
  //   return fetchMessages({
  //     cursor: nextCursor,
  //     ...query,
  //   }).finally(() => {
  //     setPendingMessagesBeforeCount(0);
  //   });
  // });

  // React.useEffect(() => {
  //   if (casts?.length !== 0) return;

  //   // This should be called after the first render, and when navigating to
  //   // emply channels
  //   fetchMessages({ limit: 30 });
  // }, [fetchMessages, casts?.length]);

  if (!casts || casts?.length === 0) {
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
    <>
      <ChannelNavBar channelId={channelId} />
      <ReverseVerticalScrollView
        ref={scrollViewRef}
        didScrollToBottomRef={didScrollToBottomRef}
        scrollCacheKey={channelId}
        onScroll={(e, { direction }) => {
          const el = e.target;

          // Bounce back when scrolling to the top of the "loading" placeholder. Makes
          // it feel like you keep scrolling like normal (ish).
          if (el.scrollTop < 10 && pendingMessagesBeforeCount)
            el.scrollTop =
              pendingMessagesBeforeCount * averageMessageListItemHeight -
              el.getBoundingClientRect().height;

          // Fetch more messages when scrolling up
          if (
            // We only care about upward scroll
            direction !== "up" ||
            // Wait until we have fetched the initial batch of messages
            castHashes.length === 0 ||
            // No need to react if we’ve already fetched the full message history
            hasAllCasts ||
            // Wait for any pending fetch requests to finish before we fetch again
            pendingMessagesBeforeCount !== 0 ||
            // Skip if manually disabled
            disableFetchMoreRef.current
          )
            return;

          const isCloseToTop =
            // ~4 viewport heights from top
            el.scrollTop < el.getBoundingClientRect().height * 4;

          if (!isCloseToTop) return;

          // fetchMoreCasts();
        }}
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
          {casts && casts.length > 0 && (
            <>
              <div css={css({ height: "1.3rem" })} />

              {casts.map((cast) => (
                <CastItem key={cast.hash} cast={cast} />
              ))}
            </>
          )}
          <div css={css({ height: "1.6rem" })} />
        </div>
      </ReverseVerticalScrollView>
    </>
  );
};

const ChannelView = ({ channelId }) => {
  const inputRef = React.useRef();
  const { fid, signer, broadcasted } = useSigner();
  const channel = useFarcasterChannel(channelId);

  const placeholderText =
    fid && signer
      ? "Compose your cast..."
      : fid && !signer
      ? "You need to create a Signer to cast"
      : fid === 0 && !signer
      ? "You need to connect your Farcaster wallet"
      : "Connect wallet to cast";

  const onSubmit = async (blocks) => {
    const text = message.stringifyBlocks(blocks);
    addCast({ fid, signer, text, parentUrl: channel.parentUrl });
  };

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
        })
      }
    >
      <ChannelCastsScrollView channelId={channelId} />

      <div css={css({ padding: "0 1.6rem" })}>
        <MessageEditorForm
          ref={inputRef}
          inline
          fileUploadDisabled
          disabled={!fid && !signer && !broadcasted}
          placeholder={placeholderText}
          submit={onSubmit}
        />
      </div>

      <div css={css({ height: "2rem" })}></div>
    </div>
  );
};

const ChannelScreen = () => {
  const { channelId } = useParams();
  const [searchParams] = useSearchParams();
  const castHash = searchParams.get("cast");

  return (
    <MainLayout>
      <ChannelView channelId={channelId} />
      {castHash && <ThreadScreen castHash={castHash} />}
    </MainLayout>
  );
};

export default ChannelScreen;
