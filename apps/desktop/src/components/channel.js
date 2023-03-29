import throttle from "lodash.throttle";
import React from "react";
import { css } from "@emotion/react";
import {
  useAuth,
  useSelectors,
  useActions,
  useBeforeActionListener,
  useMe,
  useChannel,
  useChannelAccessLevel,
  useChannelHasUnread,
  useChannelTypingMembers,
  useSortedChannelMessageIds,
  useHasAllChannelMessages,
  useHasFetchedChannelMessages,
} from "@shades/common/app";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import { useLatestCallback } from "@shades/common/react";
import useGlobalMediaQueries from "../hooks/global-media-queries";
import useWindowFocusOrDocumentVisibleListener from "../hooks/window-focus-or-document-visible-listener";
import useOnlineListener from "../hooks/window-online-listener";
import useInterval from "../hooks/interval";
import useFetch from "../hooks/fetch";
import { isNodeEmpty } from "../slate/utils";
import Spinner from "./spinner";
import ChannelMessage from "./channel-message";
import NewChannelMessageInput from "./new-channel-message-input";
import ChannelNavBar from "./channel-nav-bar";
import useIsOnScreen from "../hooks/is-on-screen";
import useScrollListener from "../hooks/scroll-listener";
import useReverseScrollPositionMaintainer from "../hooks/reverse-scroll-position-maintainer";

const pendingFetchMessagePromisesCache = {};

// This fetcher only allows for a single request (with the same query) to be
// pending at once. Subsequent "equal" request will simply return the initial
// pending request promise.
const useMessageFetcher = () => {
  const actions = useActions();

  const fetchMessages = useLatestCallback(
    async (channelId, { limit, beforeMessageId, afterMessageId } = {}) => {
      const key = new URLSearchParams([
        ["channel", channelId],
        ["limit", limit],
        ["before-message-id", beforeMessageId],
        ["after-message-id", afterMessageId],
      ]).toString();

      let pendingPromise = pendingFetchMessagePromisesCache[key];

      if (pendingPromise == null) {
        pendingPromise = actions.fetchMessages(channelId, {
          limit,
          beforeMessageId,
          afterMessageId,
        });
        pendingFetchMessagePromisesCache[key] = pendingPromise;
      }

      try {
        return await pendingPromise;
      } finally {
        delete pendingFetchMessagePromisesCache[key];
      }
    }
  );

  return fetchMessages;
};

const useScrollAwareMessageFetcher = (channelId, { scrollContainerRef }) => {
  const baseFetcher = useMessageFetcher();

  // This needs to be called before every state change that impacts the scroll
  // container height
  const maintainScrollPositionDuringTheNextDomMutation =
    useReverseScrollPositionMaintainer(scrollContainerRef);

  const [pendingMessagesBeforeCount, setPendingMessagesBeforeCount] =
    React.useState(0);

  useBeforeActionListener((action) => {
    // Maintain scroll position when new messages arrive
    if (action.type === "messages-fetched" && action.channelId === channelId)
      maintainScrollPositionDuringTheNextDomMutation();
  });

  const fetcher = React.useCallback(
    (query) => {
      if (query.beforeMessageId) {
        // Maintain scroll position when we render the loading placeholder
        maintainScrollPositionDuringTheNextDomMutation();
        setPendingMessagesBeforeCount(query.limit);
      }

      return baseFetcher(channelId, query).finally(() => {
        if (query.beforeMessageId) {
          // Maintain scroll position when we remove the loading placeholder
          maintainScrollPositionDuringTheNextDomMutation();
          setPendingMessagesBeforeCount(0);
        }
      });
    },
    [baseFetcher, channelId, maintainScrollPositionDuringTheNextDomMutation]
  );

  return { fetcher, pendingMessagesBeforeCount };
};

const useMessageInputPlaceholder = (channelId) => {
  const { accountAddress: walletAccountAddress } = useWallet();

  const { status: authenticationStatus } = useAuth();

  const me = useMe();
  const channel = useChannel(channelId, { name: true });
  const channelAccessLevel = useChannelAccessLevel(channelId);

  if (channel.kind === "dm") return `Message ${channel.name}`;

  const hasConnectedWallet = walletAccountAddress != null;
  const isAuthenticated = authenticationStatus === "authenticated";
  const isMember = me != null && channel.memberUserIds.includes(me.id);

  switch (channelAccessLevel) {
    case "private":
      return `Message #${channel.name}`;

    case "closed": {
      if (isAuthenticated)
        return isMember
          ? `Message #${channel.name}`
          : `Only members can post in #${channel.name}`;

      if (!hasConnectedWallet) return "Connect wallet to chat";

      const walletAddressIsMember = channel.members.some(
        (m) =>
          m.walletAddress != null &&
          m.walletAddress.toLowerCase() === walletAccountAddress.toLowerCase()
      );

      return walletAddressIsMember
        ? "Verify account to chat"
        : `Only members can post in #${channel.name}`;
    }

    case "open": {
      if (isAuthenticated) return `Message #${channel.name}`;
      return hasConnectedWallet
        ? "Verify account to chat"
        : "Connect wallet to chat";
    }

    default:
      return isMember ? `Message #${channel.name}` : "";
  }
};

const ChannelScreen = ({ channelId, compact, noSideMenu }) => {
  const { accountAddress: walletAccountAddress } = useWallet();
  const { login } = useWalletLogin();
  const { status: authenticationStatus } = useAuth();

  const selectors = useSelectors();
  const actions = useActions();

  const { markChannelRead } = actions;

  const me = useMe();
  const channel = useChannel(channelId, { name: true, members: true });
  const channelAccessLevel = useChannelAccessLevel(channelId);
  const channelHasUnread = useChannelHasUnread(channelId);
  const hasFetchedChannelMessagesAtLeastOnce =
    useHasFetchedChannelMessages(channelId);

  const { inputDeviceCanHover } = useGlobalMediaQueries();

  const inputRef = React.useRef();
  const scrollContainerRef = React.useRef();
  const didScrollToBottomRef = React.useRef();

  const messageIds = useSortedChannelMessageIds(channelId);

  const { fetcher: fetchMessages, pendingMessagesBeforeCount } =
    useScrollAwareMessageFetcher(channelId, { scrollContainerRef });

  const inputPlaceholder = useMessageInputPlaceholder(channelId);

  const [pendingReplyMessageId, setPendingReplyMessageId] =
    React.useState(null);

  const isMember = me != null && channel.memberUserIds.includes(me.id);

  const canPost =
    channelAccessLevel === "open"
      ? authenticationStatus === "authenticated"
      : isMember;

  const disableInput = !canPost;

  React.useEffect(() => {
    if (!inputDeviceCanHover || disableInput) return;
    inputRef.current.focus();
  }, [inputRef, inputDeviceCanHover, disableInput, channelId]);

  // Mark channel as read when new messages arrive and when switching channels
  React.useEffect(() => {
    if (
      // Only mark as read when the page has focus
      !document.hasFocus() ||
      // Wait until the initial message batch is fetched
      !hasFetchedChannelMessagesAtLeastOnce ||
      // Only mark as read when scrolled to the bottom
      !didScrollToBottomRef.current ||
      // Don’t bother if the channel is already marked as read
      !channelHasUnread
    )
      return;

    markChannelRead(channelId);
  }, [
    channelId,
    channelHasUnread,
    hasFetchedChannelMessagesAtLeastOnce,
    didScrollToBottomRef,
    markChannelRead,
  ]);

  React.useEffect(() => {
    if (messageIds.length !== 0) return;

    // This should be called after the first render, and when navigating to
    // emply channels
    fetchMessages({ limit: 30 });
  }, [fetchMessages, messageIds.length]);

  useWindowFocusOrDocumentVisibleListener(() => {
    fetchMessages({ limit: 30 });
    if (channelHasUnread && didScrollToBottomRef.current)
      markChannelRead(channelId);
  });

  useOnlineListener(
    () => {
      fetchMessages({ limit: 30 });
      if (channelHasUnread && didScrollToBottomRef.current)
        markChannelRead(channelId);
    },
    { requireFocus: true }
  );

  const submitMessage = useLatestCallback(async (blocks) => {
    setPendingReplyMessageId(null);

    if (me == null) {
      if (
        !confirm(
          "You need to verify your account to post. Sign in with your wallet to proceed."
        )
      )
        return;

      await login(walletAccountAddress);
      await actions.fetchMe();

      if (
        !confirm("Your account has been verified. Do you still wish to post?")
      )
        return;
    }

    if (channel.memberUserIds != null && !channel.memberUserIds.includes(me.id))
      await actions.joinChannel(channelId);

    return actions.createMessage({
      channel: channelId,
      blocks,
      replyToMessageId: pendingReplyMessageId,
    });
  });

  const throttledRegisterTypingActivity = React.useMemo(
    () =>
      throttle(() => actions.registerChannelTypingActivity(channel.id), 3000, {
        trailing: false,
      }),
    [actions, channel.id]
  );

  const handleInputChange = useLatestCallback((blocks) => {
    if (me == null) return;
    if (blocks.length === 0 || isNodeEmpty(blocks[0])) return;
    throttledRegisterTypingActivity();
  });

  const initReply = React.useCallback((messageId) => {
    setPendingReplyMessageId(messageId);
    inputRef.current.focus();
  }, []);

  const cancelReply = React.useCallback(() => {
    setPendingReplyMessageId(null);
    inputRef.current.focus();
  }, []);

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
      <ChannelNavBar channelId={channelId} noSideMenu={noSideMenu} />

      <ChannelMessagesScrollView
        scrollContainerRef={scrollContainerRef}
        didScrollToBottomRef={didScrollToBottomRef}
        channelId={channelId}
        compact={compact}
        fetchMessages={fetchMessages}
        initReply={initReply}
        pendingMessagesBeforeCount={pendingMessagesBeforeCount}
        pendingReplyMessageId={pendingReplyMessageId}
      />

      <div css={css({ padding: "0 1.6rem 2rem", position: "relative" })}>
        <NewChannelMessageInput
          ref={inputRef}
          disabled={disableInput}
          context={channel.kind}
          channelId={channel.id}
          replyingToMessage={
            pendingReplyMessageId == null
              ? null
              : selectors.selectMessage(pendingReplyMessageId)
          }
          cancelReply={cancelReply}
          uploadImage={actions.uploadImage}
          submit={submitMessage}
          placeholder={inputPlaceholder}
          members={channel.members}
          onInputChange={handleInputChange}
        />

        <TypingIndicator channelId={channelId} />
      </div>
    </div>
  );
};

const scrollPositionCache = {};

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

    const isAtBottom =
      Math.ceil(cachedScrollTop) + el.getBoundingClientRect().height >=
      el.scrollHeight;

    didScrollToBottomRef.current = isAtBottom;
  }, [scrollContainerRef, didScrollToBottomRef, cacheKey, scrollToBottom]);

  useScrollListener(scrollContainerRef, (e) => {
    const isAtBottom =
      Math.ceil(e.target.scrollTop) + e.target.getBoundingClientRect().height >=
      e.target.scrollHeight;

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

const ChannelMessagesScrollView = ({
  channelId,
  compact,
  fetchMessages,
  initReply,
  scrollContainerRef,
  didScrollToBottomRef,
  pendingMessagesBeforeCount,
  pendingReplyMessageId,
}) => {
  const messagesContainerRef = React.useRef();

  const { markChannelRead } = useActions();
  const user = useMe();
  const channel = useChannel(channelId, { name: true });
  const messageIds = useSortedChannelMessageIds(channelId);
  const hasAllMessages = useHasAllChannelMessages(channelId);
  const channelHasUnread = useChannelHasUnread(channelId);
  const hasFetchedChannelMessagesAtLeastOnce =
    useHasFetchedChannelMessages(channelId);

  const isAdmin = user != null && user.id === channel.ownerUserId;

  const { inputDeviceCanHover } = useGlobalMediaQueries();
  const [touchFocusedMessageId, setTouchFocusedMessageId] =
    React.useState(null);

  const [averageMessageListItemHeight, setAverageMessageListItemHeight] =
    React.useState(0);

  React.useEffect(() => {
    if (messageIds.length === 0) return;
    // Keep track of the average message height, so that we can make educated
    // guesses at what the placeholder height should be when fetching messages
    setAverageMessageListItemHeight(
      messagesContainerRef.current.scrollHeight / messageIds.length
    );
  }, [messageIds.length]);

  useScrollListener(scrollContainerRef, () => {
    // Bounce back when scrolling to the top of the "loading" placeholder. Makes
    // it feel like you keep scrolling like normal (ish).
    if (scrollContainerRef.current.scrollTop < 10 && pendingMessagesBeforeCount)
      scrollContainerRef.current.scrollTop =
        pendingMessagesBeforeCount * averageMessageListItemHeight -
        scrollContainerRef.current.getBoundingClientRect().height;
  });

  // Fetch new messages as the user scrolls up
  useScrollListener(scrollContainerRef, (e, { direction }) => {
    if (
      // We only care about upward scroll
      direction !== "up" ||
      // Wait until we have fetched the initial batch of messages
      messageIds.length === 0 ||
      // No need to react if we’ve already fetched the full message history
      hasAllMessages ||
      // Wait for any pending fetch requests to finish before we fetch again
      pendingMessagesBeforeCount !== 0
    )
      return;

    const isCloseToTop =
      // ~4 viewport heights from top
      e.target.scrollTop < e.target.getBoundingClientRect().height * 4;

    if (!isCloseToTop) return;

    fetchMessages({ beforeMessageId: messageIds[0], limit: 30 });
  });

  const { scrollToBottom } = useScroll({
    scrollContainerRef,
    didScrollToBottomRef,
    cacheKey: channelId,
    onScrollToBottom: () => {
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
    },
  });

  const lastMessageId = messageIds.slice(-1)[0];

  // Keep scroll at bottom when new messages arrive
  React.useEffect(() => {
    if (lastMessageId == null || !didScrollToBottomRef.current) return;
    scrollToBottom();
  }, [lastMessageId, scrollToBottom, didScrollToBottomRef]);

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
          {hasAllMessages && <ChannelPrologue channelId={channelId} />}

          {!hasAllMessages && messageIds.length > 0 && (
            <OnScreenTrigger
              callback={() => {
                // This should only happen on huge viewports where all messages from the
                // initial fetch fit in view without a scrollbar. All other cases should be
                // covered by the scroll listener
                fetchMessages({ beforeMessageId: messageIds[0], limit: 30 });
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
            css={(theme) =>
              css({
                minHeight: 0,
                fontSize: theme.fontSizes.channelMessages,
                fontWeight: "400",
              })
            }
          >
            {messageIds.map((messageId, i, messageIds) => (
              <ChannelMessage
                key={messageId}
                channelId={channelId}
                messageId={messageId}
                previousMessageId={messageIds[i - 1]}
                hasPendingReply={pendingReplyMessageId === messageId}
                initReply={initReply}
                isAdmin={isAdmin}
                hasTouchFocus={touchFocusedMessageId === messageId}
                giveTouchFocus={
                  inputDeviceCanHover ? undefined : setTouchFocusedMessageId
                }
                compact={compact}
              />
            ))}
            <div css={css({ height: "1.6rem" })} />
          </div>
        </div>
      </div>
    </div>
  );
};

const TypingIndicator = ({ channelId }) => {
  const members = useChannelTypingMembers(channelId);

  if (members.length === 0) return null;

  return (
    <div
      css={(theme) =>
        css({
          position: "absolute",
          left: 0,
          bottom: 0,
          padding: "0 1.5rem 0.4rem 6.5rem",
          pointerEvents: "none",
          color: theme.colors.textHeaderSecondary,
          width: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.4,
          fontSize: theme.fontSizes.tiny,
          strong: { fontWeight: "600" },
        })
      }
    >
      <span aria-live="polite" aria-atomic="true">
        {members.length === 1 ? (
          <strong>{members[0].displayName}</strong>
        ) : members.length === 2 ? (
          <>
            {members[0].displayName} and {members[1].displayName}
          </>
        ) : (
          members.map((m, i, ms) => {
            if (i === 0) return <strong key={m.id}>{m.displayName}</strong>;
            const isLast = i === ms.length - 1;
            if (isLast)
              return (
                <React.Fragment key={m.id}>
                  {" "}
                  , and<strong>{m.displayName}</strong>
                </React.Fragment>
              );
            return (
              <React.Fragment key={m.id}>
                {" "}
                , <strong>{m.displayName}</strong>
              </React.Fragment>
            );
          })
        )}{" "}
        is typing...
      </span>
    </div>
  );
};

const ChannelPrologue = ({ channelId }) => {
  const me = useMe();
  const channel = useChannel(channelId, { name: true });
  const channelAccessLevel = useChannelAccessLevel(channelId);
  const messageIds = useSortedChannelMessageIds(channelId);

  const isAdmin = me != null && me.id === channel.ownerUserId;
  const channelPrefix = channel.kind === "dm" ? "@" : "#";

  return (
    <div
      css={css({ padding: "6rem 1.6rem 0" })}
      style={{ paddingBottom: messageIds.length !== 0 ? "1rem" : 0 }}
    >
      <div
        css={(theme) =>
          css({
            borderBottom: "0.1rem solid",
            borderColor: theme.colors.borderLight,
            padding: "0 0 1.5rem",
          })
        }
      >
        <div
          css={(theme) =>
            css({
              fontSize: theme.fontSizes.huge,
              fontFamily: theme.fontStacks.headers,
              fontWeight: "500",
              color: theme.colors.textHeader,
              margin: "0 0 0.5rem",
            })
          }
        >
          Welcome to {channelPrefix}
          {channel.name}!
        </div>
        <div
          css={(theme) =>
            css({
              fontSize: theme.fontSizes.channelMessages,
              color: theme.colors.textDimmed,
            })
          }
        >
          This is the start of {channelPrefix}
          {channel.name}. {channel.description}
          {channel.kind === "topic" &&
            isAdmin &&
            channel.memberUserIds.length <= 1 &&
            channelAccessLevel != null && (
              <div
                css={(theme) =>
                  css({
                    color: theme.colors.textHighlight,
                    fontSize: theme.fontSizes.default,
                    marginTop: "1rem",
                  })
                }
              >
                {channelAccessLevel === "open" ? (
                  <>
                    This channel is open for anyone to join. Share its URL to
                    help people find it!
                  </>
                ) : (
                  <>Add members with the &ldquo;/add-member&rdquo; command.</>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
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

const Channel = ({ channelId, compact, noSideMenu }) => {
  const { status: authenticationStatus } = useAuth();
  const actions = useActions();

  const {
    fetchChannel,
    fetchChannelMembers,
    fetchChannelPublicPermissions,
    fetchApps,
  } = actions;

  const me = useMe();
  const channel = useChannel(channelId);

  const [notFound, setNotFound] = React.useState(false);

  const isMember =
    me != null && channel.memberUserIds.some((id) => id === me.id);

  const fetchMessages = useMessageFetcher();

  React.useEffect(() => {
    setNotFound(false);
    // Timeout to prevent this stalling other requests
    setTimeout(() => {
      fetchChannel(channelId).catch((e) => {
        if (e.code === 404) {
          setNotFound(true);
          return;
        }
        throw e;
      });
    }, 0);
  }, [channelId, fetchChannel, authenticationStatus]);

  useFetch(
    () => fetchChannelMembers(channelId),
    [channelId, fetchChannelMembers, authenticationStatus]
  );
  useFetch(
    () => fetchChannelPublicPermissions(channelId),
    [channelId, fetchChannelPublicPermissions, authenticationStatus]
  );
  useFetch(
    authenticationStatus === "not-authenticated"
      ? () => fetchApps(channelId)
      : undefined,
    [channelId, authenticationStatus]
  );

  React.useEffect(() => {
    fetchMessages(channelId, { limit: 30 });
  }, [channelId, fetchMessages, authenticationStatus]);

  useInterval(
    () => {
      fetchMessages(channelId, { limit: 20 });
    },
    {
      // Only long-poll fetch when user is logged out, or when not a member
      delay:
        authenticationStatus === "not-authenticated" ||
        (me != null && !isMember)
          ? 5000
          : 0,
      requireFocus: true,
      requireOnline: true,
    }
  );

  if (notFound)
    return (
      <div
        css={(theme) =>
          css({
            background: theme.colors.backgroundPrimary,
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          })
        }
      >
        Not found
      </div>
    );

  if (channel == null)
    return (
      <div
        css={(theme) =>
          css({
            background: theme.colors.backgroundPrimary,
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          })
        }
      >
        <Spinner size="2.4rem" />
      </div>
    );

  return (
    <ChannelScreen
      channelId={channelId}
      compact={compact}
      noSideMenu={noSideMenu}
    />
  );
};

export default Channel;
