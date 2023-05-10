import { getAddress as checksumEncodeAddress } from "viem";
import React from "react";
import { css } from "@emotion/react";
import {
  useActions,
  useMe,
  useChannel,
  useChannelHasUnread,
  useChannelAccessLevel,
  useSortedChannelMessageIds,
  useHasAllChannelMessages,
  useHasFetchedChannelMessages,
} from "@shades/common/app";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useLatestCallback } from "@shades/common/react";
import useIsOnScreen from "../hooks/is-on-screen.js";
import useScrollListener from "../hooks/scroll-listener.js";
import useMutationObserver from "../hooks/mutation-observer.js";
import useLayoutSetting from "../hooks/layout-setting.js";
import useReverseScrollPositionMaintainer from "../hooks/reverse-scroll-position-maintainer.js";
import ChannelPrologue, {
  PersonalDMChannelPrologue,
} from "./channel-prologue.js";
import MessageList from "./message-list.js";
import ChannelAvatar from "./channel-avatar.js";
import InlineUserButtonWithProfilePopover from "./inline-user-button-with-profile-popover.js";
import FormattedDate from "./formatted-date.js";
import RichText from "./rich-text.js";

const { truncateAddress } = ethereumUtils;

const scrollPositionCache = {};

const isScrolledToBottom = (el) =>
  // ceil is required when page is zoomed
  Math.ceil(el.scrollTop) + Math.ceil(el.getBoundingClientRect().height) >=
  el.scrollHeight;

const useScroll = ({
  cacheKey,
  scrollContainerRef,
  didScrollToBottomRef,
  onScrollToBottom,
}) => {
  const scrollToBottom = React.useCallback(
    (options) => {
      const isScrollable =
        scrollContainerRef.current.scrollHeight >
        scrollContainerRef.current.getBoundingClientRect().height;

      if (!isScrollable) {
        didScrollToBottomRef.current = true;
        return;
      }

      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        ...options,
      });
    },
    [scrollContainerRef, didScrollToBottomRef]
  );

  // Restore cached scroll position
  React.useEffect(() => {
    const { scrollTop: cachedScrollTop } = scrollPositionCache[cacheKey] ?? {};

    if (cachedScrollTop == null) {
      scrollToBottom();
      return;
    }

    const el = scrollContainerRef.current;

    el.scrollTop = cachedScrollTop;

    const isAtBottom = isScrolledToBottom(el);

    didScrollToBottomRef.current = isAtBottom;
  }, [scrollContainerRef, didScrollToBottomRef, cacheKey, scrollToBottom]);

  useScrollListener(scrollContainerRef, (e) => {
    const isAtBottom = isScrolledToBottom(e.target);

    if (isAtBottom) {
      delete scrollPositionCache[cacheKey];
      onScrollToBottom?.();
    } else {
      scrollPositionCache[cacheKey] = { scrollTop: e.target.scrollTop };
    }

    didScrollToBottomRef.current = isAtBottom;
  });

  return { scrollToBottom };
};

const ReverseVerticalScrollView = React.forwardRef(
  (
    {
      didScrollToBottomRef,
      scrollCacheKey,
      onScroll,
      onScrollToBottom,
      children,
    },
    ref
  ) => {
    const scrollContainerRef = React.useRef();

    useReverseScrollPositionMaintainer(scrollContainerRef);

    useScrollListener(scrollContainerRef, onScroll);

    const { scrollToBottom } = useScroll({
      scrollContainerRef,
      didScrollToBottomRef,
      cacheKey: scrollCacheKey,
      onScrollToBottom,
    });

    useMutationObserver(
      scrollContainerRef,
      () => {
        if (!didScrollToBottomRef.current) return;
        scrollToBottom();
      },
      { subtree: true, childList: true }
    );

    React.useImperativeHandle(ref, () => ({ scrollToBottom }), [
      scrollToBottom,
    ]);

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
              justifyContent: "flex-end",
              alignItems: "stretch",
              minHeight: "100%",
            })}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }
);

const ChannelMessagesScrollView = ({
  channelId,
  layout: customLayout,
  fetchMoreMessages: fetchMoreMessages_,
  initReply,
  didScrollToBottomRef,
  replyTargetMessageId,
}) => {
  const scrollViewRef = React.useRef();
  const messagesContainerRef = React.useRef();
  const disableFetchMoreRef = React.useRef();

  const { markChannelRead } = useActions();

  const layout_ = useLayoutSetting();
  const layout = customLayout ?? layout_;

  const messageIds = useSortedChannelMessageIds(channelId, {
    threads: layout !== "bubbles",
  });
  const hasAllMessages = useHasAllChannelMessages(channelId);
  const hasFetchedChannelMessagesAtLeastOnce =
    useHasFetchedChannelMessages(channelId);
  const channelHasUnread = useChannelHasUnread(channelId);

  const [pendingMessagesBeforeCount, setPendingMessagesBeforeCount] =
    React.useState(0);
  const [averageMessageListItemHeight, setAverageMessageListItemHeight] =
    React.useState(0);

  const fetchMoreMessages = React.useCallback(() => {
    const count = 30;
    setPendingMessagesBeforeCount(count);
    return fetchMoreMessages_({ limit: count }).finally(() => {
      setPendingMessagesBeforeCount(0);
    });
  }, [fetchMoreMessages_]);

  React.useEffect(() => {
    if (messageIds.length === 0) return;
    // Keep track of the average message height, so that we can make educated
    // guesses at what the placeholder height should be when fetching messages
    setAverageMessageListItemHeight(
      messagesContainerRef.current.scrollHeight / messageIds.length
    );
  }, [messageIds.length]);

  const lastMessageId = messageIds.slice(-1)[0];

  // Keep scroll at bottom when new messages arrive
  React.useEffect(() => {
    if (lastMessageId == null || !didScrollToBottomRef.current) return;
    scrollViewRef.current.scrollToBottom();
  }, [lastMessageId, didScrollToBottomRef]);

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
      {hasAllMessages && <ChannelIntro channelId={channelId} />}

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

      <MessageList
        ref={messagesContainerRef}
        messageIds={messageIds}
        layout={layout}
        initReply={initReply}
        replyTargetMessageId={replyTargetMessageId}
        scrollToMessage={scrollToMessage}
      />
    </ReverseVerticalScrollView>
  );
};

const ChannelIntro = ({ channelId }) => {
  const me = useMe();
  const channel = useChannel(channelId, { name: true, members: true });
  const channelAccessLevel = useChannelAccessLevel(channelId);
  const messageIds = useSortedChannelMessageIds(channelId);

  const isAdmin = me != null && me.id === channel?.ownerUserId;
  const hasMembers = channel != null && channel.memberUserIds.length > 1;

  const buildBody = () => {
    if (channel.kind === "dm") {
      return (
        <>
          This conversation is just between{" "}
          {channel.members
            .filter(
              (m) =>
                me == null ||
                m.walletAddress.toLowerCase() !== me.walletAddress.toLowerCase()
            )
            .map((m, i, ms) => {
              return (
                <React.Fragment key={m.walletAddress}>
                  <InlineUserButtonWithProfilePopover
                    userId={m.id}
                    css={(t) => css({ color: t.colors.textNormal })}
                  />
                  {i !== ms.length - 1 ? ", " : null}
                </React.Fragment>
              );
            })}{" "}
          and you.
        </>
      );
    }

    if (channel.description != null)
      return <RichText blocks={channel.descriptionBlocks} />;

    return (
      <>
        This is the very beginning of <strong>{channel.name}</strong>.
      </>
    );
  };

  const buildInfo = () => {
    if (channel.kind !== "topic" || hasMembers) return null;

    if (channelAccessLevel === "open")
      return "This channel is open for anyone to join. Share its URL to help people find it!";

    if (isAdmin)
      return <>Add members with the &ldquo;/add-member&rdquo; command.</>;

    return null;
  };

  if (channel == null || (channel.kind === "dm" && me == null)) return null;

  if (channel.kind === "dm" && channel.memberUserIds.length <= 2)
    return <DMChannelIntro channelId={channelId} />;

  return (
    <ChannelPrologue
      title={channel.name}
      subtitle={
        <>
          Created by{" "}
          <InlineUserButtonWithProfilePopover userId={channel.ownerUserId} /> on{" "}
          <FormattedDate value={channel.createdAt} day="numeric" month="long" />
        </>
      }
      image={<ChannelAvatar id={channelId} highRes size="6.6rem" />}
      body={buildBody()}
      info={buildInfo()}
      style={{ paddingBottom: messageIds.length === 0 ? 0 : "1rem" }}
    />
  );
};

const DMChannelIntro = ({ channelId }) => {
  const me = useMe();
  const channel = useChannel(channelId, { name: true, members: true });

  const membersExcludingMe = channel.members.filter(
    (m) => me != null && me.id !== m.id
  );
  const member = membersExcludingMe[0] ?? me;

  const isOwnDm = member != null && me != null && member.id === me.id;

  if (isOwnDm) return <PersonalDMChannelPrologue />;

  const title = channel.name;
  const truncatedAddress =
    member?.walletAddress == null
      ? null
      : truncateAddress(checksumEncodeAddress(member.walletAddress));

  const showSubtitle = title.toLowerCase() !== truncatedAddress?.toLowerCase();

  return (
    <ChannelPrologue
      image={<ChannelAvatar id={channelId} size="6.6rem" highRes />}
      title={title}
      subtitle={showSubtitle ? truncatedAddress : null}
      body={
        <>
          This conversation is just between{" "}
          {membersExcludingMe.map((m, i, ms) => (
            <React.Fragment key={m.id}>
              <InlineUserButtonWithProfilePopover
                userId={m.id}
                css={(t) => css({ color: t.colors.textNormal })}
              />
              {i !== ms.length - 1 && `, `}
            </React.Fragment>
          ))}{" "}
          and you.
        </>
      }
    />
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
