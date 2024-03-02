import React from "react";
import { css } from "@emotion/react";
import {
  useActions,
  useChannelHasUnread,
  useSortedChannelMessageIds,
  useHasAllChannelMessages,
  useHasFetchedChannelMessages,
  useChannelLastPageEndMessageId,
  useChannelMessagesFetcher,
} from "@shades/common/app";
import {
  useLatestCallback,
  useMatchMedia,
  useIsOnScreen,
  ReverseVerticalScrollView,
} from "@shades/common/react";

const ChannelMessagesScrollView = ({
  channelId,
  renderHeader,
  renderMessage,
  didScrollToBottomRef: didScrollToBottomRefExternal,
  threads = false,
}) => {
  const scrollViewRef = React.useRef();
  const messagesContainerRef = React.useRef();
  const disableFetchMoreRef = React.useRef();
  const didScrollToBottomRefInternal = React.useRef();
  const didScrollToBottomRef =
    didScrollToBottomRefExternal ?? didScrollToBottomRefInternal;

  const { markChannelRead } = useActions();

  const messageIds = useSortedChannelMessageIds(channelId, {
    threads,
  });
  const lastPageEndMessageId = useChannelLastPageEndMessageId(channelId);
  const hasAllMessages = useHasAllChannelMessages(channelId);
  const hasFetchedChannelMessagesAtLeastOnce =
    useHasFetchedChannelMessages(channelId);
  const channelHasUnread = useChannelHasUnread(channelId);

  const [pendingMessagesBeforeCount, setPendingMessagesBeforeCount] =
    React.useState(0);
  const [averageMessageListItemHeight, setAverageMessageListItemHeight] =
    React.useState(0);

  const fetchMessages = useChannelMessagesFetcher(channelId);

  const fetchMoreMessages = useLatestCallback(async (query) => {
    const count = 30;
    setPendingMessagesBeforeCount(count);
    return fetchMessages({
      beforeMessageId: lastPageEndMessageId,
      limit: count,
      ...query,
    }).finally(() => {
      setPendingMessagesBeforeCount(0);
    });
  });

  React.useEffect(() => {
    if (messageIds.length === 0) return;
    // Keep track of the average message height, so that we can make educated
    // guesses at what the placeholder height should be when fetching messages
    setAverageMessageListItemHeight(
      messagesContainerRef.current.scrollHeight / messageIds.length,
    );
  }, [messageIds.length]);

  const lastMessageId = messageIds.slice(-1)[0];

  // Keep scroll at bottom when new messages arrive
  React.useEffect(() => {
    if (lastMessageId == null || !didScrollToBottomRef.current) return;
    scrollViewRef.current.scrollToBottom();
  }, [lastMessageId, didScrollToBottomRef]);

  const inputDeviceCanHover = useMatchMedia("(hover: hover)");
  const [touchFocusedMessageId, setTouchFocusedMessageId] =
    React.useState(null);

  const scrollToMessage = useLatestCallback((id) => {
    const scrollTo = () => {
      const el = document.querySelector(`[data-message-id="${id}"]`);
      if (el == null) return false;
      disableFetchMoreRef.current = true;
      el.scrollIntoView({ behavior: "instant", block: "start" });
      requestAnimationFrame(() => {
        disableFetchMoreRef.current = false;
      });
      return true;
    };

    if (scrollTo()) return;

    const scrollToFetchedMessage = (query) =>
      fetchMoreMessages(query).then((ms) => {
        if (ms.some((m) => m.id === id)) {
          scrollTo();
          return;
        }

        scrollToFetchedMessage({
          beforeMessageId: ms.slice(-1)[0].id,
          limit: 30,
        });
      });

    scrollToFetchedMessage();
  });

  return (
    <ReverseVerticalScrollView
      ref={scrollViewRef}
      didScrollToBottomRef={didScrollToBottomRef}
      scrollCacheKey={channelId}
      onScrollToBottom={() => {
        if (
          // Only mark as read when the page has focus
          document.hasFocus() &&
          // Wait until the initial message batch is fetched
          hasFetchedChannelMessagesAtLeastOnce &&
          // Don’t bother if the channel is already marked as read
          channelHasUnread
        ) {
          markChannelRead(channelId);
        }
      }}
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
          messageIds.length === 0 ||
          // No need to react if we’ve already fetched the full message history
          hasAllMessages ||
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

        fetchMoreMessages();
      }}
    >
      {hasAllMessages && renderHeader?.()}

      {!hasAllMessages && messageIds.length > 0 && (
        <OnScreenTrigger
          callback={() => {
            // This should only happen on huge viewports where all messages from the
            // initial fetch fit in view without a scrollbar. All other cases should be
            // covered by the scroll listener
            fetchMoreMessages();
          }}
        />
      )}

      {pendingMessagesBeforeCount > 0 && (
        <div
          style={{
            height: `${
              pendingMessagesBeforeCount * averageMessageListItemHeight
            }px`,
          }}
        />
      )}

      <div
        ref={messagesContainerRef}
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
              "--bg-focus": t.colors.backgroundModifierLight,
              background: "var(--background, transparent)",
              padding: "var(--padding)",
              borderRadius: "var(--border-radius, 0)",
              color: `var(--color, ${t.colors.textNormal})`,
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
        {messageIds.length > 0 && <div css={css({ height: "1.3rem" })} />}
        {messageIds.map((id, index, ids) =>
          renderMessage(id, index, ids, {
            threads,
            scrollToMessage,
            isTouchFocused: touchFocusedMessageId === id,
            setTouchFocused: inputDeviceCanHover
              ? undefined
              : setTouchFocusedMessageId,
          }),
        )}
        <div css={css({ height: "1.6rem" })} />
      </div>
    </ReverseVerticalScrollView>
  );
};

const OnScreenTrigger = ({ callback }) => {
  const ref = React.useRef();
  const callbackRef = React.useRef(callback);

  const isOnScreen = useIsOnScreen(ref);

  React.useEffect(() => {
    callbackRef.current = callback;
  });

  React.useEffect(() => {
    if (isOnScreen) callbackRef.current();
  }, [isOnScreen]);

  return <div ref={ref} />;
};

export default ChannelMessagesScrollView;
