import React from "react";
import { css } from "@emotion/react";
import { ReverseVerticalScrollView } from "@shades/common/react";
import Spinner from "@shades/ui-web/spinner";
import { CastItem } from "./cast.js";
import ChannelNavBar from "./channel-navbar.js";
import {
  ChainDataCacheDispatchContext,
  useFarcasterChannel,
} from "../hooks/farcord.js";
import { message } from "@shades/common/utils";
import useSigner from "./signer";
import { addCast } from "../hooks/hub.js";
import {
  useChannelCacheContext,
  useChannelCasts,
  useChannelCastsFetch,
  useChannelHasUnread,
  useChannelLastReadCast,
  useFeedCasts,
  useFeedCastsFetch,
} from "../hooks/channel.js";
import { toHex } from "viem";
import useFarcasterAccount from "./farcaster-account.js";
import MessageEditorForm from "./message-editor-form.js";
import isHotkey from "is-hotkey";
import { usePreviousValue } from "../hooks/previous-value.js";

export const ChannelCastsScrollView = ({
  channelId,
  isFeed = false,
  isRecent = false,
  didScrollToBottomRef: didScrollToBottomRefExternal,
}) => {
  const dispatch = React.useContext(ChainDataCacheDispatchContext);
  const scrollViewRef = React.useRef();
  const castsContainerRef = React.useRef();
  const didScrollToBottomRefInternal = React.useRef();
  const disableFetchMoreRef = React.useRef();
  const didScrollToBottomRef =
    didScrollToBottomRefExternal ?? didScrollToBottomRefInternal;

  const { fid } = useFarcasterAccount();

  const channel = useFarcasterChannel(
    isFeed ? "feed" : isRecent ? "recent" : channelId
  );

  useChannelCastsFetch({ channel, cursor: null });
  const channelCasts = useChannelCasts(channelId);

  useFeedCastsFetch({ fid, cursor: null });
  const feedCasts = useFeedCasts(fid);

  useFeedCastsFetch({});
  const recentCasts = useFeedCasts();

  const casts = isFeed ? feedCasts : isRecent ? recentCasts : channelCasts;

  const [pendingMessagesBeforeCount] = React.useState(0);
  const [averageMessageListItemHeight] = React.useState(0);

  const castHashes = casts?.map((cast) => cast.hash) ?? [];
  const hasAllCasts = false;

  const channelHasUnread = useChannelHasUnread(channelId);
  const lastReadCastHash = useChannelLastReadCast(channelId);
  const previousLastReadCastHash = usePreviousValue(lastReadCastHash);
  const [ignoreMarker, setIgnoreMarker] = React.useState(false);
  const isEscapeHotkey = isHotkey("escape");

  const {
    actions: { markChannelRead },
  } = useChannelCacheContext();

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (isEscapeHotkey(e)) setIgnoreMarker(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  React.useEffect(() => {
    if (!channel && !isFeed && !isRecent && channelId)
      dispatch({
        type: "add-channel-by-parent-url",
        id: channelId,
        value: channelId,
      });
  }, [channelId, isFeed, isRecent, channel, dispatch]);

  React.useEffect(() => {
    if (
      // Only mark as read when the page has focus
      !document.hasFocus() ||
      // Wait until the initial message batch is fetched
      !channelCasts ||
      // Only mark as read when scrolled to the bottom
      !didScrollToBottomRef.current ||
      // Don’t bother if the channel is already marked as read
      !channelHasUnread
    )
      return;

    markChannelRead({
      channelId,
      lastCastHash: channelCasts?.slice(-1)[0].hash,
    });
  }, [
    channelId,
    didScrollToBottomRef,
    channelCasts,
    channelHasUnread,
    markChannelRead,
  ]);

  if (!casts) {
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

  if (casts.length === 0 && isFeed) {
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
        Follow some folks and start building your feed.
      </div>
    );
  }

  return (
    <>
      {isFeed ? (
        <ChannelNavBar name="Feed" description="A feed made just for you ❤️" />
      ) : isRecent ? (
        <ChannelNavBar
          name="Recent"
          description="Most recent protocol casts, unfiltered!"
        />
      ) : (
        <ChannelNavBar
          channelId={channelId}
          name={channel?.name}
          description={channel?.description}
        />
      )}
      {casts.length == 0 ? (
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
          No casts yet
        </div>
      ) : (
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
                  <CastItem
                    key={cast.hash}
                    cast={cast}
                    isFeed={isFeed}
                    isRecent={isRecent}
                    showReplies={true}
                    showLastReadMark={
                      !ignoreMarker &&
                      previousLastReadCastHash != lastReadCastHash &&
                      cast.hash == previousLastReadCastHash
                    }
                  />
                ))}
              </>
            )}
            <div css={css({ height: "1.6rem" })} />
          </div>
        </ReverseVerticalScrollView>
      )}
    </>
  );
};

const ChannelView = ({ channelId, isFeed, isRecent }) => {
  const inputRef = React.useRef();
  const { fid } = useFarcasterAccount();
  const { signer, broadcasted } = useSigner();

  const {
    actions: { fetchChannelCasts },
  } = useChannelCacheContext();

  const channel = useFarcasterChannel(channelId);

  const placeholderText = broadcasted
    ? "Compose your cast..."
    : "Connect wallet and create signer to cast";

  const onSubmit = async (blocks) => {
    const text = message.stringifyBlocks(blocks);
    return addCast({
      fid,
      signer,
      text,
      parentUrl: isFeed || isRecent ? null : channel.parentUrl,
    })
      .then((result) => {
        return toHex(result.value.hash);
      })
      .then(() => {
        return fetchChannelCasts({ channel: channel });
      });
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
      <ChannelCastsScrollView
        channelId={channelId}
        isFeed={isFeed}
        isRecent={isRecent}
      />

      <div css={css({ padding: "0 1.6rem" })}>
        <MessageEditorForm
          ref={inputRef}
          inline
          fileUploadDisabled
          disabled={!broadcasted}
          placeholder={placeholderText}
          submit={async (blocks) => {
            await onSubmit(blocks);
          }}
        />
      </div>

      <div css={css({ height: "2rem" })}></div>
    </div>
  );
};

export default ChannelView;
