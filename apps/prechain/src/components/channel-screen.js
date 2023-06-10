import React from "react";
import { useParams } from "react-router-dom";
import { css } from "@emotion/react";
import { useAccount } from "wagmi";
import {
  useAuth,
  useActions,
  useMe,
  useMessage,
  useChannel,
  useChannelAccessLevel,
  useSortedChannelMessageIds,
  useChannelMessagesFetcher,
  useChannelFetchEffects,
  useMarkChannelReadEffects,
  // useStringifiedMessageContent,
} from "@shades/common/app";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import {
  useLatestCallback,
  useWindowFocusOrDocumentVisibleListener,
  useWindowOnlineListener,
  useMatchMedia,
} from "@shades/common/react";
import Button from "@shades/ui-web/button";
import { CrossCircle as CrossCircleIcon } from "@shades/ui-web/icons";
import AccountPreviewPopoverTrigger from "@shades/ui-web/account-preview-popover-trigger";
import MessageEditorForm from "@shades/ui-web/message-editor-form";
import ChannelMessagesScrollView from "@shades/ui-web/channel-messages-scroll-view";
import ChannelMessage from "./channel-message.js";
import RichText from "./rich-text.js";

const ChannelContent = ({ channelId }) => {
  const { address: connectedWalletAccountAddress } = useAccount();
  const { connect: connectWallet, isConnecting: isConnectingWallet } =
    useWallet();
  const { login: initAccountVerification, status: accountVerificationStatus } =
    useWalletLogin();

  const { status: authenticationStatus } = useAuth();

  const actions = useActions();

  const me = useMe();
  const channel = useChannel(channelId, { name: true, members: true });
  const channelAccessLevel = useChannelAccessLevel(channelId);

  const inputDeviceCanHover = useMatchMedia("(hover: hover)");

  const inputRef = React.useRef();
  const didScrollToBottomRef = React.useRef(false);

  const messageIds = useSortedChannelMessageIds(channelId);

  const fetchMessages = useChannelMessagesFetcher(channelId);

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

  useWindowOnlineListener(
    () => {
      fetchMessages({ limit: 30 });
    },
    { requireFocus: true }
  );

  useMarkChannelReadEffects(channelId, { didScrollToBottomRef });

  const initReply = useLatestCallback((targetMessageId) => {
    setReplyTargetMessageId(
      targetMessageId === replyTargetMessageId ? null : targetMessageId
    );
    inputRef.current.focus();
  });

  const cancelReply = React.useCallback(() => {
    setReplyTargetMessageId(null);
    inputRef.current.focus();
  }, []);

  // const renderScrollViewHeader = React.useCallback(
  //   () => <ChannelMessagesScrollViewHeader channelId={channelId} />,
  //   [channelId]
  // );

  const [touchFocusedMessageId, setTouchFocusedMessageId] =
    React.useState(null);

  const renderMessage = React.useCallback(
    (messageId, i, messageIds, props) => (
      <ChannelMessage
        key={messageId}
        messageId={messageId}
        previousMessageId={messageIds[i - 1]}
        hasPendingReply={replyTargetMessageId === messageId}
        initReply={initReply}
        isTouchFocused={messageId === touchFocusedMessageId}
        setTouchFocused={setTouchFocusedMessageId}
        scrollToMessage={() => {
          //
        }}
        {...props}
      />
    ),
    [initReply, replyTargetMessageId, touchFocusedMessageId]
  );

  const replyTargetMessage = useMessage(replyTargetMessageId);

  return (
    <>
      <ChannelMessagesScrollView
        channelId={channelId}
        didScrollToBottomRef={didScrollToBottomRef}
        renderHeader={
          channel?.body == null
            ? null
            : () => (
                <div css={css({ padding: "1.5rem 1.5rem 0" })}>
                  <div
                    css={(t) =>
                      css({
                        paddingBottom: "1.5rem",
                        borderBottom: "0.1rem solid",
                        borderColor: t.colors.borderLight,
                      })
                    }
                  >
                    <RichText blocks={channel.body} />
                  </div>
                </div>
              )
        }
        renderMessage={renderMessage}
      />

      <div css={css({ padding: "0 1.6rem 2rem" })}>
        <MessageEditorForm
          ref={inputRef}
          inline
          disabled={authenticationStatus !== "authenticated"}
          placeholder={channel == null ? "..." : `Message ${channel.name}`}
          submit={async (blocks) => {
            setReplyTargetMessageId(null);

            if (
              channel.memberUserIds != null &&
              !channel.memberUserIds.includes(me.id)
            )
              await actions.joinChannel(channelId);

            actions.createMessage({
              channel: channelId,
              blocks,
              replyToMessageId: replyTargetMessageId,
            });
          }}
          uploadImage={actions.uploadImage}
          // members={channel?.members ?? []}
          // commands={messageInputCommands}
          onKeyDown={(e) => {
            if (!e.isDefaultPrevented() && e.key === "Escape") {
              e.preventDefault();
              cancelReply?.();
            }
          }}
          renderSubmitArea={
            authenticationStatus === "authenticated"
              ? null
              : () => (
                  <div
                    style={{
                      alignSelf: "flex-end",
                      display: "flex",
                      height: 0,
                    }}
                  >
                    <div
                      style={{
                        alignSelf: "flex-end",
                        display: "grid",
                        gridAutoFlow: "column",
                        gridAutoColumns: "auto",
                        gridGap: "1.6rem",
                        alignItems: "center",
                      }}
                    >
                      <div
                        css={(t) =>
                          css({
                            fontSize: t.text.sizes.small,
                            color: t.colors.textDimmed,
                            "@media(max-width: 600px)": {
                              display: "none",
                            },
                          })
                        }
                      >
                        Account verification required
                      </div>
                      {connectedWalletAccountAddress == null ? (
                        <Button
                          size="small"
                          variant="primary"
                          isLoading={isConnectingWallet}
                          disabled={isConnectingWallet}
                          onClick={() => {
                            connectWallet();
                          }}
                        >
                          Connect wallet
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="primary"
                          isLoading={accountVerificationStatus !== "idle"}
                          disabled={accountVerificationStatus !== "idle"}
                          onClick={() => {
                            initAccountVerification(
                              connectedWalletAccountAddress
                            ).then(() => {
                              inputRef.current.focus();
                            });
                          }}
                        >
                          Verify account
                        </Button>
                      )}
                    </div>
                  </div>
                )
          }
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
      </div>
    </>
  );
};

// const MessageContent = ({ inline, messageId }) => {
//   const message = useMessage(messageId);

//   return message.isSystemMessage ? (
//     <StringifiedMessageContent messageId={messageId} />
//   ) : (
//     <RichText inline={inline} blocks={message.content} />
//   );
// };

const ChannelScreen = () => {
  const { channelId } = useParams();

  useChannelFetchEffects(channelId);

  return (
    <Layout channelId={channelId}>
      <ChannelContent channelId={channelId} />
    </Layout>
  );
};

const NavBar = ({ channelId }) => {
  const channel = useChannel(channelId, { name: true });
  return (
    <div
      css={(t) =>
        css({
          fontSize: t.fontSizes.header,
          fontWeight: t.text.weights.header,
          color: t.colors.textHeader,
          padding: "1rem 1.5rem",
          height: "4.4rem",
          display: "flex",
          alignItems: "center",
        })
      }
    >
      {channel?.name}
    </div>
  );
};

// const StringifiedMessageContent = React.memo(({ messageId }) =>
//   useStringifiedMessageContent(messageId)
// );

const Layout = ({ channelId, children }) => (
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
    <NavBar channelId={channelId} />
    {children}
  </div>
);

export default ChannelScreen;
