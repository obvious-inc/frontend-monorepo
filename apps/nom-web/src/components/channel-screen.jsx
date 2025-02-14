import throttle from "lodash.throttle";
import React from "react";
import { useParams } from "react-router-dom";
import { Helmet as ReactHelmet } from "react-helmet";
import { useAccount } from "wagmi";
import { css } from "@emotion/react";
import {
  useAuth,
  useActions,
  useSelectors,
  useMe,
  useMessage,
  useChannel,
  useChannelName,
  useChannelAccessLevel,
  useChannelTypingMembers,
  useSortedChannelMessageIds,
  useChannelMessagesFetcher,
  useChannelFetchEffects,
  useMarkChannelReadEffects,
} from "@shades/common/app";
import { getImageDimensionsFromUrl } from "@shades/common/utils";
import useLayoutSetting from "../hooks/layout-setting.js";
import {
  useLatestCallback,
  useWindowFocusOrDocumentVisibleListener,
  useWindowOnlineListener,
  useMatchMedia,
} from "@shades/common/react";
import ChannelMessagesScrollView from "@shades/ui-web/channel-messages-scroll-view";
import { isNodeEmpty as isRichTextNodeEmpty } from "@shades/ui-web/rich-text-editor";
import { CrossCircleSolid as CrossCircleIcon } from "@shades/ui-web/icons";
import MessageEditorForm from "@shades/ui-web/message-editor-form";
import Spinner from "@shades/ui-web/spinner";
import useWalletLogin from "../hooks/wallet-login";
import useMessageInputPlaceholder from "../hooks/channel-message-input-placeholder.js";
import useCommands from "../hooks/commands";
import Delay from "./delay";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger";
import ChannelMessagesScrollViewHeader from "./channel-messages-scroll-view-header";
import ChannelNavBar from "./channel-nav-bar";
import ChannelMessage from "./channel-message";

const LazyLoginScreen = React.lazy(() => import("./login-screen"));

const Channel = ({ channelId }) => {
  const { address: walletAccountAddress } = useAccount();
  const { login } = useWalletLogin();
  const { status: authenticationStatus } = useAuth();

  const actions = useActions();
  const selectors = useSelectors();

  const me = useMe();
  const channel = useChannel(channelId, { name: true, members: true });
  const channelAccessLevel = useChannelAccessLevel(channelId);

  const layout = useLayoutSetting();

  const inputDeviceCanHover = useMatchMedia("(hover: hover)");

  const inputRef = React.useRef();
  const didScrollToBottomRef = React.useRef(false);

  const messageIds = useSortedChannelMessageIds(channelId);

  const fetchMessages = useChannelMessagesFetcher(channelId);

  const inputPlaceholder = useMessageInputPlaceholder(channelId);

  const [replyTargetMessageId, setReplyTargetMessageId] = React.useState(null);
  const replyTargetMessage = useMessage(replyTargetMessageId);

  const isMember =
    me != null && channel != null && channel.memberUserIds.includes(me.id);

  const messageInputCommands = useCommands({
    context: channel?.kind,
    channelId,
  });

  const canPost =
    channelAccessLevel === "open"
      ? authenticationStatus === "authenticated"
      : isMember;

  const disableInput = !canPost;

  const enableThreads = false; // layout !== "bubbles"

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

  useWindowOnlineListener(
    () => {
      fetchMessages({ limit: 30 });
    },
    { requireFocus: true },
  );

  useMarkChannelReadEffects(channelId, { didScrollToBottomRef });

  const submitMessage = useLatestCallback(async (blocks) => {
    setReplyTargetMessageId(null);

    if (me == null) {
      if (
        !confirm(
          "You need to verify your account to post. Sign in with your wallet to proceed.",
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

    actions.createMessage({
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
    [actions, channelId],
  );

  const handleInputChange = useLatestCallback(({ rawRichTextNodes }) => {
    if (me == null) return;
    if (rawRichTextNodes.every((n) => isRichTextNodeEmpty(n))) return;
    throttledRegisterTypingActivity();
  });

  const initReply = useLatestCallback((targetMessageId_) => {
    const targetMessageId = enableThreads
      ? // If threads are enabled, we reply to the thread target message
        (selectors.selectMessage(targetMessageId_)?.replyTargetMessageId ??
        targetMessageId_)
      : targetMessageId_;
    setReplyTargetMessageId(targetMessageId);
    inputRef.current.focus();
  });

  const cancelReply = React.useCallback(() => {
    setReplyTargetMessageId(null);
    inputRef.current.focus();
  }, []);

  const renderScrollViewHeader = React.useCallback(
    () => <ChannelMessagesScrollViewHeader channelId={channelId} />,
    [channelId],
  );

  const renderMessage = React.useCallback(
    (messageId, i, messageIds, props) => (
      <ChannelMessage
        key={messageId}
        messageId={messageId}
        previousMessageId={messageIds[i - 1]}
        hasPendingReply={replyTargetMessageId === messageId}
        initReply={initReply}
        layout={layout}
        {...props}
      />
    ),
    [layout, initReply, replyTargetMessageId],
  );

  return (
    <>
      <ChannelMessagesScrollView
        channelId={channelId}
        didScrollToBottomRef={didScrollToBottomRef}
        renderHeader={renderScrollViewHeader}
        renderMessage={renderMessage}
        threads={enableThreads}
      />

      <div css={css({ padding: "0 1.6rem" })}>
        <MessageEditorForm
          ref={inputRef}
          inline
          disabled={disableInput}
          placeholder={inputPlaceholder}
          submit={submitMessage}
          uploadImage={actions.uploadImage}
          members={channel?.members ?? []}
          commands={messageInputCommands}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (!e.isDefaultPrevented() && e.key === "Escape") {
              e.preventDefault();
              cancelReply?.();
            }
          }}
          header={
            replyTargetMessageId == null ? null : (
              <div css={css({ display: "flex", alignItems: "center" })}>
                <div css={css({ flex: 1, paddingRight: "1rem" })}>
                  Replying to{" "}
                  <AccountPreviewPopoverTrigger
                    userId={replyTargetMessage.authorUserId}
                    variant="link"
                    css={(t) =>
                      css({
                        color: t.colors.textDimmed,
                        ":disabled": { color: t.colors.textMuted },
                      })
                    }
                  />
                </div>
                <button
                  onClick={cancelReply}
                  css={(t) =>
                    css({
                      color: t.colors.textDimmed,
                      outline: "none",
                      borderRadius: "50%",
                      marginRight: "-0.2rem",
                      ":focus-visible": {
                        boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
                      },
                      "@media (hover: hover)": {
                        cursor: "pointer",
                        ":hover": {
                          color: t.colors.textDimmedModifierHover,
                        },
                      },
                    })
                  }
                >
                  <CrossCircleIcon
                    style={{ width: "1.6rem", height: "auto" }}
                  />
                </button>
              </div>
            )
          }
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
          fontSize: t.text.sizes.tiny,
          strong: { fontWeight: t.text.weights.emphasis },
        })
      }
    >
      {members.length === 1 ? (
        <>
          <strong>{members[0].displayName}</strong> is typing...
        </>
      ) : members.length === 2 ? (
        <>
          {members[0].displayName} and {members[1].displayName} are typing...
        </>
      ) : (
        <>
          {members.map((m, i, ms) => {
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
          })}{" "}
          are typing...
        </>
      )}
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

const ChannelScreen = ({ channelId, noSideMenu }) => {
  const { status: authenticationStatus } = useAuth();

  const me = useMe();
  const channel = useChannel(channelId);

  const notFound = useChannelNotFound(channelId);
  const layout = useLayoutSetting();

  useChannelFetchEffects(channelId);

  if (notFound)
    return authenticationStatus === "not-authenticated" ? (
      <React.Suspense fallback={null}>
        <LazyLoginScreen />
      </React.Suspense>
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
      <Channel channelId={channelId} layout={layout} />
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
        href={`https://app.nom.xyz/channels/${channelId}`}
      />

      <title>{`${name} - NOM`}</title>
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

export default function ChannelRoute({ noSideMenu = false }) {
  const params = useParams();
  const { status } = useAuth();
  if (status === "loading") return null;
  return (
    <>
      <MetaTags channelId={params.channelId} />
      <ChannelScreen channelId={params.channelId} noSideMenu={noSideMenu} />
    </>
  );
}
