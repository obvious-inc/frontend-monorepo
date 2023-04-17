import throttle from "lodash.throttle";
import React from "react";
import { css } from "@emotion/react";
import {
  useAuth,
  useActions,
  useSelectors,
  useBeforeActionListener,
  useMe,
  useChannel,
  useChannelAccessLevel,
  useChannelHasUnread,
  useChannelTypingMembers,
  useSortedChannelMessageIds,
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
import ChannelMessagesScrollView from "./channel-messages-scroll-view";
import NewChannelMessageInput from "./new-channel-message-input";
import ChannelNavBar from "./channel-nav-bar";
import ErrorBoundary from "./error-boundary.js";
import useReverseScrollPositionMaintainer from "../hooks/reverse-scroll-position-maintainer";

const LazyLoginScreen = React.lazy(() => import("./login-screen"));

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

export const useScrollAwareMessageFetcher = (
  channelId,
  { scrollContainerRef }
) => {
  const baseFetcher = useMessageFetcher();

  // This needs to be called before every state change that impacts the scroll
  // container height
  const maintainScrollPositionDuringTheNextDomMutation =
    useReverseScrollPositionMaintainer(scrollContainerRef);

  const [pendingMessagesBeforeCount, setPendingMessagesBeforeCount] =
    React.useState(0);

  useBeforeActionListener((action) => {
    // Maintain scroll position when new messages arrive
    if (
      action.type === "fetch-messages:request-successful" &&
      action.channelId === channelId
    )
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

  if (channel == null) return "...";

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

const ChannelContent = ({ channelId, layout }) => {
  const { accountAddress: walletAccountAddress } = useWallet();
  const { login } = useWalletLogin();
  const { status: authenticationStatus } = useAuth();

  const actions = useActions();
  const selectors = useSelectors();

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
  const didScrollToBottomRef = React.useRef(false);

  const messageIds = useSortedChannelMessageIds(channelId);

  const { fetcher: fetchMessages, pendingMessagesBeforeCount } =
    useScrollAwareMessageFetcher(channelId, { scrollContainerRef });

  const fetchMoreMessages = useLatestCallback((args) =>
    fetchMessages(args ?? { beforeMessageId: messageIds[0], limit: 30 })
  );

  const inputPlaceholder = useMessageInputPlaceholder(channelId);

  const [replyTargetMessageId, setReplyTargetMessageId] = React.useState(null);

  const isMember =
    me != null && channel != null && channel.memberUserIds.includes(me.id);

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
    setReplyTargetMessageId(null);

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
      replyToMessageId: replyTargetMessageId,
    });
  });

  const throttledRegisterTypingActivity = React.useMemo(
    () =>
      throttle(() => actions.registerChannelTypingActivity(channelId), 3000, {
        trailing: false,
      }),
    [actions, channelId]
  );

  const handleInputChange = useLatestCallback((blocks) => {
    if (me == null) return;
    if (blocks.length === 0 || isNodeEmpty(blocks[0])) return;
    throttledRegisterTypingActivity();
  });

  const initReply = useLatestCallback((targetMessageId) => {
    const targetMessage = selectors.selectMessage(targetMessageId);
    setReplyTargetMessageId(
      targetMessage?.replyTargetMessageId ?? targetMessageId
    );
    inputRef.current.focus();
  });

  const cancelReply = React.useCallback(() => {
    setReplyTargetMessageId(null);
    inputRef.current.focus();
  }, []);

  return (
    <>
      <ChannelMessagesScrollView
        channelId={channelId}
        layout={layout}
        scrollContainerRef={scrollContainerRef}
        didScrollToBottomRef={didScrollToBottomRef}
        fetchMoreMessages={fetchMoreMessages}
        initReply={initReply}
        replyTargetMessageId={replyTargetMessageId}
        pendingMessagesBeforeCount={pendingMessagesBeforeCount}
      />

      <div css={css({ padding: "0 1.6rem" })}>
        <NewChannelMessageInput
          ref={inputRef}
          disabled={disableInput}
          context={channel?.kind}
          channelId={channelId}
          replyTargetMessageId={replyTargetMessageId}
          cancelReply={cancelReply}
          uploadImage={actions.uploadImage}
          submit={submitMessage}
          placeholder={inputPlaceholder}
          members={channel?.members ?? []}
          onInputChange={handleInputChange}
        />

        <TypingIndicator channelId={channelId} />
      </div>
    </>
  );
};

const TypingIndicator = ({ channelId }) => {
  const members = useChannelTypingMembers(channelId);

  if (members.length === 0) return <div style={{ height: "2rem" }} />;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      css={(t) =>
        css({
          padding: "0 1.6rem",
          height: "2rem",
          pointerEvents: "none",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.8,
          color: t.colors.textDimmed,
          fontSize: t.fontSizes.tiny,
          strong: { fontWeight: "600" },
        })
      }
    >
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
                , and <strong>{m.displayName}</strong>
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
    </div>
  );
};

const Channel = ({ channelId, layout, noSideMenu }) => {
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
    me != null &&
    channel != null &&
    channel.memberUserIds.some((id) => id === me.id);

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
    return authenticationStatus === "not-authenticated" ? (
      <ErrorBoundary fallback={() => window.location.reload()}>
        <React.Suspense fallback={null}>
          <LazyLoginScreen />
        </React.Suspense>
      </ErrorBoundary>
    ) : (
      <Layout channelId={channelId} noSideMenu={noSideMenu}>
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
          Not found
        </div>
      </Layout>
    );

  if (channel == null)
    return (
      <Layout channelId={channelId} noSideMenu={noSideMenu}>
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
      </Layout>
    );

  return (
    <Layout channelId={channelId} noSideMenu={noSideMenu}>
      <ChannelContent channelId={channelId} layout={layout} />
    </Layout>
  );
};

const Layout = ({ channelId, noSideMenu, children }) => (
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
    {children}
  </div>
);

export default Channel;
