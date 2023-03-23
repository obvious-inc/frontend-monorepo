import throttle from "lodash.throttle";
import { utils as ethersUtils } from "ethers";
import { useProvider as useEthersProvider } from "wagmi";
import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Helmet as ReactHelmet } from "react-helmet";
import { css, useTheme } from "@emotion/react";
import {
  useAuth,
  useSelectors,
  useActions,
  useBeforeActionListener,
  useMe,
  useChannel,
  useChannelName,
  useChannelMembers,
  useChannelAccessLevel,
  useIsChannelStarred,
  useChannelHasUnread,
  useChannelHasOpenReadAccess,
  useChannelTypingMembers,
  useSortedChannelMessageIds,
  useHasAllChannelMessages,
  useHasFetchedChannelMessages,
} from "@shades/common/app";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import {
  getImageDimensionsFromUrl,
  array as arrayUtils,
  ethereum as ethereumUtils,
  user as userUtils,
} from "@shades/common/utils";
import { useLatestCallback } from "@shades/common/react";
import Button from "@shades/ui-web/button";
import Dialog from "@shades/ui-web/dialog";
import {
  Cross as CrossIcon,
  Star as StarIcon,
  StrokedStar as StrokedStarIcon,
  Globe as GlobeIcon,
} from "@shades/ui-web/icons";
import useGlobalMediaQueries from "../hooks/global-media-queries";
import useWindowFocusOrDocumentVisibleListener from "../hooks/window-focus-or-document-visible-listener";
import useOnlineListener from "../hooks/window-online-listener";
import useInterval from "../hooks/interval";
import { isNodeEmpty } from "../slate/utils";
import Spinner from "./spinner";
import ChannelMessage from "./channel-message";
import ChannelHeader from "./channel-header";
import UserAvatar from "./user-avatar";
import ChannelAvatar from "./channel-avatar";
import * as Tooltip from "./tooltip";
import Input from "./input";
import ChannelInfoDialog from "./channel-info-dialog";
import NewChannelMessageInput from "./new-channel-message-input";
import useIsOnScreen from "../hooks/is-on-screen";
import useScrollListener from "../hooks/scroll-listener";
import useMutationObserver from "../hooks/mutation-observer";

const { sort } = arrayUtils;
const { truncateAddress } = ethereumUtils;

const useFetch = (fetcher, dependencies) => {
  const fetcherRef = React.useRef(fetcher);

  React.useEffect(() => {
    fetcherRef.current = fetcher;
  });

  React.useEffect(() => {
    fetcherRef.current?.();
  }, dependencies); // eslint-disable-line

  useWindowFocusOrDocumentVisibleListener(() => {
    fetcherRef.current?.();
  });

  useOnlineListener(
    () => {
      fetcherRef.current?.();
    },
    { requireFocus: true }
  );
};

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

const useMessages = (channelId) => {
  const messageIds = useSortedChannelMessageIds(channelId);
  const hasAllMessages = useHasAllChannelMessages(channelId);

  return { messageIds, hasAllMessages };
};

const useScroll = (scrollContainerRef, { cacheKey, onScrollToBottom }) => {
  const didScrollToBottomRef = React.useRef(false);

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
    [scrollContainerRef]
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
  }, [scrollContainerRef, cacheKey, scrollToBottom]);

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

  return { didScrollToBottomRef, scrollToBottom };
};

const useReverseScrollPositionMaintainer = (scrollContainerRef) => {
  // Whenever this ref is truthy we will try to maintain the scroll position
  // (keep the same distance to the bottom) when the scroll container’s scroll
  // height changes
  const maintainScrollPositionRef = React.useRef(false);

  const maintainScrollPositionDuringTheNextDomMutation =
    React.useCallback(() => {
      maintainScrollPositionRef.current = true;
    }, []);

  const prevScrollHeightRef = React.useRef();
  const prevScrollTopRef = React.useRef();

  React.useEffect(() => {
    if (prevScrollHeightRef.current == null)
      prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
    if (prevScrollTopRef.current == null)
      prevScrollTopRef.current = scrollContainerRef.current.scrollTop;
  }, [scrollContainerRef]);

  useMutationObserver(
    scrollContainerRef,
    () => {
      const el = scrollContainerRef.current;

      if (el == null) return;

      if (maintainScrollPositionRef.current) {
        maintainScrollPositionRef.current = false;

        if (prevScrollHeightRef.current === el.scrollHeight) return;

        const scrollHeightDiff = el.scrollHeight - prevScrollHeightRef.current;

        // console.log(
        //   "scroll adjust",
        //   [el.scrollTop, prevScrollHeightRef.current + scrollHeightDiff].join(
        //     " -> "
        //   )
        // );

        // Even with 'overflow-anchor' set to 'none', some browsers still mess
        // with the scroll, so we keep track of the most recent position in
        // `prevScrollTopRef` and use that when adjusting `scrollTop`
        el.scrollTop = prevScrollTopRef.current + scrollHeightDiff;
        prevScrollTopRef.current = el.scrollTop;
      }

      // if (prevScrollHeightRef.current !== el.scrollHeight) {
      //   console.log(
      //     "height change",
      //     [prevScrollHeightRef.current, el.scrollHeight].join(" -> ")
      //   );
      // }

      prevScrollHeightRef.current = el.scrollHeight;
    },
    { subtree: true, childList: true }
  );

  useScrollListener(scrollContainerRef, () => {
    prevScrollTopRef.current = scrollContainerRef.current.scrollTop;
  });

  return maintainScrollPositionDuringTheNextDomMutation;
};

const scrollPositionCache = {};

export const ChannelBase = ({
  channelId,
  accessLevel: channelAccessLevel,
  typingMembers,
  createMessage,
  headerContent,
  compact,
  noSideMenu,
}) => {
  const { accountAddress: walletAccountAddress } = useWallet();
  const { login } = useWalletLogin();
  const { status: authenticationStatus } = useAuth();
  const hasConnectedWallet = walletAccountAddress != null;

  const selectors = useSelectors();
  const actions = useActions();

  const { markChannelRead } = actions;

  const user = useMe();
  const channel = useChannel(channelId);
  const channelName = useChannelName(channelId);
  const isAdmin = user != null && user.id === channel.ownerUserId;
  const members = useChannelMembers(channelId);

  const { inputDeviceCanHover } = useGlobalMediaQueries();
  const [touchFocusedMessageId, setTouchFocusedMessageId] =
    React.useState(null);

  const messagesContainerRef = React.useRef();
  const scrollContainerRef = React.useRef();

  const maintainScrollPositionDuringTheNextDomMutation =
    useReverseScrollPositionMaintainer(scrollContainerRef);

  const { didScrollToBottomRef, scrollToBottom } = useScroll(
    scrollContainerRef,
    {
      cacheKey: channel.id,
      onScrollToBottom: () => {
        if (
          // Only mark as read when the page has focus
          document.hasFocus() &&
          // Wait until the initial message batch is fetched
          hasFetchedChannelMessagesAtLeastOnce &&
          // Don’t bother if the channel is already marked as read
          channelHasUnread
        ) {
          markChannelRead(channel.id);
        }
      },
    }
  );

  useBeforeActionListener((action) => {
    // Maintain scroll position when new messages arrive
    if (action.type === "messages-fetched" && action.channelId === channel.id)
      maintainScrollPositionDuringTheNextDomMutation();
  });

  const fetchMessages_ = useMessageFetcher();
  const fetchMessages = useLatestCallback((channelId, query) => {
    if (query.beforeMessageId) {
      // Maintain scroll position when we render the loading placeholder
      maintainScrollPositionDuringTheNextDomMutation();
      setPendingMessagesBeforeCount(query.limit);
    }

    return fetchMessages_(channelId, query).finally(() => {
      if (query.beforeMessageId) {
        // Maintain scroll position when we remove the loading placeholder
        maintainScrollPositionDuringTheNextDomMutation();
        setPendingMessagesBeforeCount(0);
      }
    });
  });

  const { messageIds, hasAllMessages } = useMessages(channel.id);

  const inputRef = React.useRef();

  const isMember = user != null && channel.memberUserIds.includes(user.id);

  const canPost =
    channelAccessLevel === "open"
      ? authenticationStatus === "authenticated"
      : isMember;

  const disableInput = !canPost;

  React.useEffect(() => {
    if (!inputDeviceCanHover || disableInput) return;
    inputRef.current.focus();
  }, [inputRef, inputDeviceCanHover, disableInput, channel.id]);

  const [pendingReplyMessageId, setPendingReplyMessageId] =
    React.useState(null);

  const initReply = React.useCallback((messageId) => {
    setPendingReplyMessageId(messageId);
    inputRef.current.focus();
  }, []);

  const cancelReply = React.useCallback(() => {
    setPendingReplyMessageId(null);
    inputRef.current.focus();
  }, []);

  React.useEffect(() => {
    if (messageIds.length !== 0) return;

    // This should be called after the first render, and when navigating to
    // emply channels
    fetchMessages(channel.id, { limit: 30 });
  }, [fetchMessages, channel.id, messageIds.length]);

  const channelHasUnread = useChannelHasUnread(channel.id);

  const [pendingMessagesBeforeCount, setPendingMessagesBeforeCount] =
    React.useState(0);

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
  useScrollListener(
    scrollContainerRef,
    (e, { direction }) => {
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

      fetchMessages(channel.id, {
        beforeMessageId: messageIds[0],
        limit: 30,
      });
    },
    [channel.id]
  );

  const hasFetchedChannelMessagesAtLeastOnce = useHasFetchedChannelMessages(
    channel.id
  );

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

    markChannelRead(channel.id);
  }, [
    channel.id,
    channelHasUnread,
    hasFetchedChannelMessagesAtLeastOnce,
    didScrollToBottomRef,
    markChannelRead,
  ]);

  const lastMessageId = messageIds.slice(-1)[0];

  // Keep scroll at bottom when new messages arrive
  React.useEffect(() => {
    if (lastMessageId == null || !didScrollToBottomRef.current) return;
    scrollToBottom();
  }, [lastMessageId, scrollToBottom, didScrollToBottomRef]);

  useWindowFocusOrDocumentVisibleListener(() => {
    fetchMessages(channel.id, { limit: 30 });
    if (channelHasUnread && didScrollToBottomRef.current)
      markChannelRead(channel.id);
  });

  useOnlineListener(
    () => {
      fetchMessages(channel.id, { limit: 30 });
      if (channelHasUnread && didScrollToBottomRef.current)
        markChannelRead(channel.id);
    },
    { requireFocus: true }
  );

  const submitMessage = useLatestCallback(async (blocks) => {
    setPendingReplyMessageId(null);
    if (user == null) {
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

    return createMessage({
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
    if (user == null) return;
    if (blocks.length > 1 || !isNodeEmpty(blocks[0]))
      throttledRegisterTypingActivity();
  });

  const channelPrefix = channel.kind === "dm" ? "@" : "#";

  const inputPlaceholder = (() => {
    if (channel.kind === "dm") return `Message ${channelName}`;

    const isAuthenticated = authenticationStatus === "authenticated";

    switch (channelAccessLevel) {
      case "private":
        return `Message #${channelName}`;

      case "closed": {
        if (isAuthenticated)
          return isMember
            ? `Message #${channelName}`
            : `Only members can post in #${channelName}`;

        if (!hasConnectedWallet) return "Connect wallet to chat";

        const walletAddressIsMember = members.some(
          (m) =>
            m.walletAddress != null &&
            m.walletAddress.toLowerCase() === walletAccountAddress.toLowerCase()
        );

        return walletAddressIsMember
          ? "Verify account to chat"
          : `Only members can post in #${channelName}`;
      }

      case "open": {
        if (isAuthenticated) return `Message #${channelName}`;
        return hasConnectedWallet
          ? "Verify account to chat"
          : "Connect wallet to chat";
      }

      default:
        return isMember ? `Message #${channelName}` : "";
    }
  })();

  return (
    <div
      css={(theme) => css`
        position: relative;
        z-index: 0;
        flex: 1;
        min-width: min(30.6rem, 100vw);
        background: ${theme.colors.backgroundPrimary};
        display: flex;
        flex-direction: column;
        height: 100%;
      `}
    >
      <ChannelHeader noSideMenu={noSideMenu}>{headerContent}</ChannelHeader>

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
            {hasAllMessages && (
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
                    {channelName}!
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
                    {channelName}. {channel.description}
                    {channel.kind === "topic" &&
                      isAdmin &&
                      members.length <= 1 &&
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
                              This channel is open for anyone to join. Share its
                              URL to help people find it!
                            </>
                          ) : (
                            <>
                              Add members with the &ldquo;/add-member&rdquo;
                              command.
                            </>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}
            {!hasAllMessages && messageIds.length > 0 && (
              <OnScreenTrigger
                callback={() => {
                  // This should only happen on huge viewports where all messages from the
                  // initial fetch fit in view without a scrollbar. All other cases should be
                  // covered by the scroll listener
                  fetchMessages(channel.id, {
                    beforeMessageId: messageIds[0],
                    limit: 30,
                  });
                }}
              />
            )}
            {pendingMessagesBeforeCount > 0 && (
              <div
                css={css({
                  height: `${
                    pendingMessagesBeforeCount * averageMessageListItemHeight
                  }px`,
                })}
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
                  channelId={channel.id}
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
          members={members}
          onInputChange={handleInputChange}
        />
        {typingMembers.length > 0 && (
          <TypingIndicator members={typingMembers} />
        )}
      </div>
    </div>
  );
};

const TypingIndicator = ({ members }) => (
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
    {/* <svg width="24.5" height="7"> */}
    {/*   <g> */}
    {/*     <circle cx="3.5" cy="3.5" r="3.5" fill="currentColor" /> */}
    {/*     <circle cx="12.25" cy="3.5" r="3.5" fill="currentColor" /> */}
    {/*     <circle cx="21" cy="3.5" r="3.5" fill="currentColor" /> */}
    {/*   </g> */}
    {/* </svg> */}
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

const Heading = ({ component: Component = "div", children, ...props }) => (
  <Component
    css={(theme) =>
      css({
        fontSize: theme.fontSizes.headerDefault,
        fontWeight: theme.text.weights.header,
        color: theme.colors.textHeader,
        fontFamily: theme.fontStacks.headers,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        userSelect: "text",
        cursor: "default",
      })
    }
    {...props}
  >
    {children}
  </Component>
);

export const Channel = ({ channelId, compact, noSideMenu }) => {
  const [searchParams] = useSearchParams();
  const { status: authenticationStatus } = useAuth();
  const actions = useActions();

  const user = useMe();

  const {
    connect: connectWallet,
    // cancel: cancelWalletConnectionAttempt,
    // canConnect: canConnectWallet,
    accountAddress: walletAccountAddress,
    accountEnsName,
    // chain,
    isConnecting: isConnectingWallet,
    // error: walletError,
    // switchToEthereumMainnet,
  } = useWallet();

  const {
    login,
    status: loginStatus,
    // error: loginError
  } = useWalletLogin();

  const [notFound, setNotFound] = React.useState(false);
  const [channelDialogMode, setChannelDialogMode] = React.useState(null);
  const [isAddMemberDialogOpen, setAddMemberDialogOpen] = React.useState(false);

  const isChannelDialogOpen = channelDialogMode != null;

  const {
    fetchChannel,
    fetchChannelMembers,
    fetchChannelPublicPermissions,
    fetchApps,
  } = actions;

  const fetchMessages = useMessageFetcher(channelId);

  const channel = useChannel(channelId);
  const channelAccessLevel = useChannelAccessLevel(channelId);
  const isChannelStarred = useIsChannelStarred(channelId);

  const members = useChannelMembers(channelId);
  const isFetchingMembers = members.some((m) => m.walletAddress == null);
  const isMember = user != null && members.some((m) => m.id === user.id);

  const createMessage = useLatestCallback(
    async ({ blocks, replyToMessageId }) => {
      if (
        channel.memberUserIds != null &&
        !channel.memberUserIds.includes(user?.id)
      )
        await actions.joinChannel(channelId);

      return actions.createMessage({
        channel: channelId,
        blocks,
        replyToMessageId,
      });
    }
  );

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
        (user != null && !isMember)
          ? 5000
          : 0,
      requireFocus: true,
      requireOnline: true,
    }
  );

  const theme = useTheme();
  const isEmbedded = searchParams.get("mode") === "embedded";
  const hasPendingWalletAction =
    isConnectingWallet || loginStatus === "requesting-signature";

  const channelName = useChannelName(channelId);
  const hasOpenReadAccess = useChannelHasOpenReadAccess(channelId);
  const typingChannelMembers = useChannelTypingMembers(channelId);

  const headerContent = (() => {
    if (channel == null) return null;

    const isChannelOwner = user != null && channel.ownerUserId === user?.id;

    const renderRightColumn = () => {
      if (
        authenticationStatus === "not-authenticated" &&
        hasPendingWalletAction
      )
        return (
          <div
            css={(theme) =>
              css({
                display: "flex",
                color: theme.colors.textDimmed,
                paddingLeft: "0.5rem",
              })
            }
          >
            Check your wallet...
            <Spinner size="1.8rem" style={{ marginLeft: "1rem" }} />
          </div>
        );

      return (
        <div
          css={css({
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "auto",
            gridGap: "0.4rem",
            alignItems: "center",
          })}
        >
          <button
            onClick={() => {
              const tryStarChannel = async () => {
                if (authenticationStatus !== "authenticated") {
                  if (walletAccountAddress == null) {
                    alert(
                      "You need to connect and verify your account to star channels."
                    );
                    return;
                  }

                  if (
                    !confirm(
                      `You need to verify your account to star channels. Press ok to verify "${truncateAddress(
                        walletAccountAddress
                      )}" with wallet signature.`
                    )
                  )
                    return;
                  await login(walletAccountAddress);
                }

                if (isChannelStarred) {
                  actions.unstarChannel(channel.id);
                  return;
                }

                await actions.starChannel(channel.id);

                if (isEmbedded)
                  window.open(
                    `${window.location.origin}/channels/${channel.id}`,
                    "_blank"
                  );
              };

              tryStarChannel();
            }}
            css={(t) =>
              css({
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "0.3rem",
                width: "3.3rem",
                height: "2.8rem",
                padding: 0,
                transition: "background 20ms ease-in",
                outline: "none",
                ":hover": {
                  background: t.colors.backgroundModifierHover,
                },
                ":focus-visible": {
                  boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
                },
              })
            }
          >
            {isChannelStarred ? (
              <StarIcon style={{ color: "rgb(202, 152, 73)" }} />
            ) : (
              <StrokedStarIcon />
            )}
          </button>

          {!isFetchingMembers && members.length !== 0 && (
            <>
              <MembersDisplayButton
                onClick={() => {
                  setChannelDialogMode("members");
                }}
                members={members}
              />
              <Dialog
                isOpen={isChannelDialogOpen}
                onRequestClose={() => {
                  setChannelDialogMode(null);
                }}
                height="min(calc(100% - 3rem), 82rem)"
              >
                {({ titleProps }) => (
                  <ChannelInfoDialog
                    channelId={channelId}
                    initialTab={channelDialogMode}
                    members={members}
                    titleProps={titleProps}
                    showAddMemberDialog={
                      channel.kind === "topic" && isChannelOwner
                        ? () => {
                            setAddMemberDialogOpen(true);
                          }
                        : null
                    }
                    dismiss={() => {
                      setChannelDialogMode(null);
                    }}
                  />
                )}
              </Dialog>
            </>
          )}

          {hasOpenReadAccess && (
            <Tooltip.Root>
              <Tooltip.Trigger>
                <span>
                  <GlobeIcon
                    css={(t) =>
                      css({ width: "2rem", color: t.colors.textNormal })
                    }
                  />
                </span>
              </Tooltip.Trigger>
              <Tooltip.Content sideOffset={5}>
                Open read access
                <br />
                <span css={(t) => css({ color: t.colors.textDimmed })}>
                  Messages can be read by anyone
                </span>
              </Tooltip.Content>
            </Tooltip.Root>
          )}

          <Dialog
            isOpen={isAddMemberDialogOpen}
            onRequestClose={() => {
              setAddMemberDialogOpen(false);
            }}
            width="40rem"
          >
            {({ titleProps }) => (
              <AddMemberDialog
                channelId={channelId}
                dismiss={() => {
                  setAddMemberDialogOpen(false);
                }}
                titleProps={titleProps}
              />
            )}
          </Dialog>

          {authenticationStatus === "not-authenticated" && (
            <span
              css={(theme) =>
                css({
                  display: "flex",
                  alignItems: "center",
                  fontSize: theme.fontSizes.default,
                  paddingLeft: "0.5rem",
                  overflow: "hidden",
                })
              }
            >
              {walletAccountAddress == null ? (
                <Button
                  size="small"
                  variant={theme.name === "nouns.tv" ? "primary" : "default"}
                  onClick={connectWallet}
                >
                  Connect wallet
                </Button>
              ) : (
                <>
                  {isEmbedded && (
                    <span
                      css={css({
                        flex: 1,
                        minWidth: 0,
                        userSelect: "text",
                        cursor: "default",
                        whiteSpace: "nowrap",
                        overflow: "auto",
                        marginRight: "1.2rem",
                      })}
                    >
                      <a
                        href={`https://etherscan.io/address/${walletAccountAddress}`}
                        rel="noreferrer"
                        target="_blank"
                        css={(theme) =>
                          css({
                            display: "inline-flex",
                            alignItems: "center",
                            color: theme.colors.link,
                            ":hover": {
                              color: theme.colors.linkModifiedHover,
                            },
                            ":hover [data-avatar]": { opacity: 0.9 },
                          })
                        }
                      >
                        {accountEnsName}{" "}
                        {accountEnsName == null ? (
                          truncateAddress(walletAccountAddress)
                        ) : (
                          <>({truncateAddress(walletAccountAddress)})</>
                        )}
                        <UserAvatar
                          data-avatar
                          transparent
                          walletAddress={walletAccountAddress}
                          size="2.6rem"
                          style={{ marginLeft: "0.5rem" }}
                        />
                      </a>
                    </span>
                  )}

                  <Button
                    size="small"
                    variant={theme.name === "nouns.tv" ? "primary" : "default"}
                    onClick={() => {
                      login(walletAccountAddress);
                    }}
                  >
                    Verify account
                  </Button>
                </>
              )}
            </span>
          )}
        </div>
      );
    };

    return (
      <>
        {channel.image != null && (
          <a
            href={channel.imageLarge}
            rel="noreferrer"
            target="_blank"
            css={(t) =>
              css({
                borderRadius: "50%",
                outline: "none",
                ":focus-visible": {
                  boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
                },
              })
            }
            style={{ marginRight: "1.1rem" }}
          >
            <ChannelAvatar transparent id={channel.id} size="2.4rem" />
          </a>
        )}

        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          {!isEmbedded && (
            <Heading
              component="button"
              onClick={() => {
                setChannelDialogMode("about");
              }}
              css={(t) =>
                css({
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  cursor: "pointer",
                  ":hover": { color: t.colors.textNormal },
                })
              }
            >
              {channelName}
            </Heading>
          )}

          {channel.description != null && (
            <button
              onClick={() => {
                setChannelDialogMode("about");
              }}
              css={(t) =>
                css({
                  flex: 1,
                  minWidth: 0,
                  color: t.colors.textHeaderSecondary,
                  marginLeft: "1.1rem",
                  padding: "0 1.1rem",
                  borderLeft: "1px solid",
                  borderColor: "hsl(0 0% 100% / 20%)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  userSelect: "text",
                  cursor: "pointer",
                  maxWidth: "100%",
                  ":hover": { color: t.colors.textDimmedModifierHover },
                })
              }
            >
              {channel.description}
            </button>
          )}
        </div>

        {renderRightColumn()}
      </>
    );
  })();

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
    <ChannelBase
      compact={compact}
      noSideMenu={noSideMenu}
      channelId={channelId}
      typingMembers={typingChannelMembers}
      createMessage={createMessage}
      accessLevel={channelAccessLevel}
      headerContent={headerContent}
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

const MembersDisplayButton = React.forwardRef(({ onClick, members }, ref) => {
  const theme = useTheme();
  const sortedMembers = React.useMemo(
    () => sort(userUtils.createDefaultComparator(), members),
    [members]
  );

  const memberCount = members.length;
  const onlineMemberCount = members.filter(
    (m) => m.onlineStatus === "online"
  ).length;

  const membersToDisplay = sortedMembers.slice(0, 3);

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          ref={ref}
          onClick={onClick}
          css={(t) =>
            css({
              display: "flex",
              alignItems: "center",
              padding: "0.2rem 0.6rem",
              height: "2.8rem",
              borderRadius: "0.3rem",
              outline: "none",
              cursor: "pointer",
              ":focus-visible": {
                boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
              },
              ":hover": { background: t.colors.backgroundModifierHover },
            })
          }
        >
          {membersToDisplay.map((user, i) => (
            <UserAvatar
              key={user.id}
              transparent
              background={theme.colors.backgroundTertiary}
              walletAddress={user?.walletAddress}
              size="2rem"
              css={(theme) =>
                css({
                  marginLeft: i === 0 ? 0 : "-0.4rem",
                  boxShadow: `0 0 0 0.2rem ${theme.colors.backgroundPrimary}`,
                  position: "relative",
                  zIndex: `calc(${i} * -1)`,
                  borderRadius: theme.avatars.borderRadius,
                })
              }
            />
          ))}

          <div
            css={(theme) =>
              css({
                marginLeft: "0.4rem",
                padding: "0 0.3rem",
                fontSize: theme.fontSizes.small,
                color: theme.colors.textHeaderSecondary,
              })
            }
          >
            {members.length}
          </div>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content sideOffset={5}>
        View all members of this channel
        <div css={(t) => css({ color: t.colors.textDimmed })}>
          {onlineMemberCount === memberCount
            ? "All members online"
            : `${onlineMemberCount} ${
                onlineMemberCount === 1 ? "member" : "members"
              } online`}
        </div>
      </Tooltip.Content>
    </Tooltip.Root>
  );
});

const AddMemberDialog = ({ channelId, dismiss, titleProps }) => {
  const ethersProvider = useEthersProvider();
  const actions = useActions();

  const inputRef = React.useRef();

  const [query, setQuery] = React.useState("");
  const [hasPendingRequest, setPendingRequest] = React.useState(false);

  const trimmedQuery = query.trim();

  const hasRequiredInput = trimmedQuery.split(" ").some((s) => {
    const query = s.trim();
    return query.endsWith(".eth") || ethersUtils.isAddress(query);
  });

  const submit = async () => {
    const walletAddressOrEnsList = trimmedQuery.split(" ").map((s) => s.trim());
    const addresses = [];

    setPendingRequest(true);
    try {
      for (let walletAddressOrEns of walletAddressOrEnsList) {
        try {
          const address = await ethersProvider.resolveName(walletAddressOrEns);
          addresses.push(address);
        } catch (e) {
          if (e.code === "INVALID_ARGUMENT")
            throw new Error(`Invalid address "${walletAddressOrEns}"`);
          throw e;
        }
      }

      await actions.addChannelMember(channelId, addresses);
      dismiss();
    } catch (e) {
      console.error(e);
      // TODO
    } finally {
      setPendingRequest(false);
    }
  };

  React.useEffect(() => {
    inputRef.current.focus();
  }, []);

  return (
    <div
      css={css({
        padding: "1.5rem",
        "@media (min-width: 600px)": {
          padding: "2rem",
        },
      })}
    >
      <header
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          alignItems: "flex-end",
          margin: "0 0 1.5rem",
          "@media (min-width: 600px)": {
            margin: "0 0 2rem",
          },
        })}
      >
        <h1
          css={(t) =>
            css({
              fontSize: t.fontSizes.header,
              lineHeight: 1.2,
            })
          }
          {...titleProps}
        >
          Add member
        </h1>
        <Button
          size="small"
          onClick={() => {
            dismiss();
          }}
          css={css({ width: "2.8rem", padding: 0 })}
        >
          <CrossIcon
            style={{ width: "1.5rem", height: "auto", margin: "auto" }}
          />
        </Button>
      </header>
      <main>
        <form
          id="add-member-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            ref={inputRef}
            size="large"
            value={query}
            disabled={hasPendingRequest}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="ENS name or wallet address"
          />
        </form>
      </main>
      <footer
        css={css({
          display: "flex",
          justifyContent: "flex-end",
          paddingTop: "1.5rem",
          "@media (min-width: 600px)": {
            paddingTop: "2rem",
          },
        })}
      >
        <Button
          type="submit"
          form="add-member-form"
          size="medium"
          variant="primary"
          isLoading={hasPendingRequest}
          disabled={!hasRequiredInput || hasPendingRequest}
          style={{ width: "8rem" }}
        >
          Add
        </Button>
      </footer>
    </div>
  );
};

const MetaTags = ({ channelId }) => {
  const channel = useChannel(channelId);
  const name = useChannelName(channelId);

  const [imageDimensions, setImageDimensions] = React.useState(null);

  React.useEffect(() => {
    if (channel?.image == null) {
      setImageDimensions(null);
      return;
    }

    getImageDimensionsFromUrl(channel.image).then((dimensions) => {
      setImageDimensions(dimensions);
    });
  }, [channel?.image]);

  if (channel == null) return null;

  return (
    <ReactHelmet>
      <link
        rel="canonical"
        href={`https://app.newshades.xyz/channels/${channelId}`}
      />

      <title>{`${name} - NewShades`}</title>
      <meta name="description" content={channel.description} />

      <meta property="og:title" content={name} />
      <meta property="og:description" content={channel.description} />

      {channel.image != null && (
        <meta property="og:image" content={channel.image} />
      )}

      {imageDimensions != null && (
        <meta property="og:image:width" content={imageDimensions.width} />
      )}
      {imageDimensions != null && (
        <meta property="og:image:height" content={imageDimensions.height} />
      )}
    </ReactHelmet>
  );
};

export default (props) => {
  const params = useParams();
  const { status } = useAuth();
  if (status === "loading") return null;
  return (
    <>
      <MetaTags channelId={params.channelId} />
      <Channel
        channelId={params.channelId}
        {...props}
        compact={location.search.includes("compact=1")}
      />
    </>
  );
};
