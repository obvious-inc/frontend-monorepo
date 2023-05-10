import throttle from "lodash.throttle";
import React from "react";
import { useAccount } from "wagmi";
import { css } from "@emotion/react";
import {
  useAuth,
  useActions,
  useSelectors,
  useMe,
  useChannel,
  useChannelAccessLevel,
  useChannelHasUnread,
  useChannelTypingMembers,
  useSortedChannelMessageIds,
  useHasFetchedChannelMessages,
} from "@shades/common/app";
import { useWalletLogin } from "@shades/common/wallet";
import { useLatestCallback } from "@shades/common/react";
import { isNodeEmpty } from "../slate/utils.js";
import useGlobalMediaQueries from "../hooks/global-media-queries.js";
import useWindowFocusOrDocumentVisibleListener from "../hooks/window-focus-or-document-visible-listener.js";
import useOnlineListener from "../hooks/window-online-listener.js";
import useLayoutSetting from "../hooks/layout-setting.js";
import useChannelFetchEffects from "../hooks/channel-fetch-effects.js";
// import useScrollAwareChannelMessagesFetcher from "../hooks/scroll-aware-channel-messages-fetcher.js";
import useChannelMessagesFetcher from "../hooks/channel-messages-fetcher.js";
import useMessageInputPlaceholder from "../hooks/channel-message-input-placeholder.js";
import Delay from "./delay.js";
import Spinner from "./spinner.js";
import ChannelMessagesScrollView from "./channel-messages-scroll-view.js";
import NewChannelMessageInput from "./new-channel-message-input.js";
import ChannelNavBar from "./channel-nav-bar.js";
import ErrorBoundary from "./error-boundary.js";

const LazyLoginScreen = React.lazy(() => import("./login-screen"));

const useMarkChannelReadEffects = (channelId, { didScrollToBottomRef }) => {
  const { markChannelRead } = useActions();

  const channelHasUnread = useChannelHasUnread(channelId);
  const hasFetchedChannelMessagesAtLeastOnce =
    useHasFetchedChannelMessages(channelId);

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

  useWindowFocusOrDocumentVisibleListener(() => {
    if (channelHasUnread && didScrollToBottomRef.current)
      markChannelRead(channelId);
  });

  useOnlineListener(
    () => {
      if (channelHasUnread && didScrollToBottomRef.current)
        markChannelRead(channelId);
    },
    { requireFocus: true }
  );
};

const ChannelContent = ({ channelId }) => {
  const { address: walletAccountAddress } = useAccount();
  const { login } = useWalletLogin();
  const { status: authenticationStatus } = useAuth();

  const actions = useActions();
  const selectors = useSelectors();

  const me = useMe();
  const channel = useChannel(channelId, { name: true, members: true });
  const channelAccessLevel = useChannelAccessLevel(channelId);

  const { inputDeviceCanHover } = useGlobalMediaQueries();

  const inputRef = React.useRef();
  const didScrollToBottomRef = React.useRef(false);

  const messageIds = useSortedChannelMessageIds(channelId);

  const fetchMessages = useChannelMessagesFetcher(channelId);

  const fetchMoreMessages = useLatestCallback((args) =>
    fetchMessages({ beforeMessageId: messageIds[0], limit: 30, ...args })
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

  React.useEffect(() => {
    if (messageIds.length !== 0) return;

    // This should be called after the first render, and when navigating to
    // emply channels
    fetchMessages({ limit: 30 });
  }, [fetchMessages, messageIds.length]);

  useWindowFocusOrDocumentVisibleListener(() => {
    fetchMessages({ limit: 30 });
  });

  useOnlineListener(
    () => {
      fetchMessages({ limit: 30 });
    },
    { requireFocus: true }
  );

  useMarkChannelReadEffects(channelId, { didScrollToBottomRef });

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
        didScrollToBottomRef={didScrollToBottomRef}
        fetchMoreMessages={fetchMoreMessages}
        initReply={initReply}
        replyTargetMessageId={replyTargetMessageId}
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

const useChannelNotFound = (channelId) => {
  const { status: authenticationStatus } = useAuth();
  const { fetchChannel } = useActions();

  const [notFound, setNotFound] = React.useState(false);

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

  return notFound;
};

const Channel = ({ channelId, noSideMenu }) => {
  const { status: authenticationStatus } = useAuth();

  const me = useMe();
  const channel = useChannel(channelId);

  const notFound = useChannelNotFound(channelId);
  const layout = useLayoutSetting();

  useChannelFetchEffects(channelId);

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

  if (
    channel == null ||
    // The message bubble layout uses the logged in user’s id to decide what
    // messages to right align. We wait to the user response here to prevent
    // layout shift.
    (layout === "bubbles" &&
      authenticationStatus === "authenticated" &&
      me == null)
  )
    return (
      <Layout channelId={channelId} noSideMenu={noSideMenu}>
        <Delay millis={1000}>
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
        </Delay>
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
