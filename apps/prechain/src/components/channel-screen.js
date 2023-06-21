import React from "react";
import { useParams } from "react-router-dom";
import { css } from "@emotion/react";
import { useAccount } from "wagmi";
import {
  useActions,
  useMe,
  useMessage,
  useChannel,
  useSortedChannelMessageIds,
  useChannelMessagesFetcher,
  useChannelFetchEffects,
  useMarkChannelReadEffects,
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
import MessageEditorForm from "@shades/ui-web/message-editor-form";
import ChannelMessagesScrollView from "@shades/ui-web/channel-messages-scroll-view";
import { useWriteAccess } from "../hooks/write-access-scope.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import ChannelMessage from "./channel-message.js";
import RichText from "./rich-text.js";
import FormattedDate from "./formatted-date.js";

const ChannelContent = ({ channelId }) => {
  const { address: connectedWalletAccountAddress } = useAccount();
  const { connect: connectWallet, isConnecting: isConnectingWallet } =
    useWallet();
  const { login: initAccountVerification, status: accountVerificationStatus } =
    useWalletLogin();

  const actions = useActions();

  const me = useMe();
  const channel = useChannel(channelId, { name: true, members: true });

  const inputDeviceCanHover = useMatchMedia("(hover: hover)");

  const inputRef = React.useRef();
  const didScrollToBottomRef = React.useRef(false);

  const messageIds = useSortedChannelMessageIds(channelId);

  const fetchMessages = useChannelMessagesFetcher(channelId);

  const [replyTargetMessageId, setReplyTargetMessageId] = React.useState(null);

  const writeAccessState = useWriteAccess();

  const hasVerifiedWriteAccess = writeAccessState === "authorized";
  const hasUnverifiedWriteAccess = writeAccessState === "authorized-unverified";

  const disableInput = !hasVerifiedWriteAccess && !hasUnverifiedWriteAccess;

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
            : () => <ChannelHeader channelId={channelId} />
        }
        renderMessage={renderMessage}
      />

      <div css={css({ padding: "0 1.6rem 2rem" })}>
        <MessageEditorForm
          ref={inputRef}
          inline
          disabled={!hasVerifiedWriteAccess && !hasUnverifiedWriteAccess}
          placeholder={
            channel?.name == null ? "..." : `Message ${channel.name}`
          }
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
            writeAccessState === "authorized" ? null : writeAccessState ===
              "loading" ? (
              <div />
            ) : (
              () => (
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
                    {writeAccessState === "unauthorized" ||
                    writeAccessState === "unauthorized-unverified" ? (
                      <div
                        css={(t) =>
                          css({
                            fontSize: t.text.sizes.small,
                            color: t.colors.textDimmed,
                          })
                        }
                      >
                        Only noun holders and delegates can post
                      </div>
                    ) : (
                      <>
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

                        {writeAccessState === "unknown" ? (
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
                          // Write access state is "authorized-unverfified"
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
                      </>
                    )}
                  </div>
                </div>
              )
            )
          }
          header={
            replyTargetMessageId == null ? null : (
              <div css={css({ display: "flex", alignItems: "center" })}>
                <div css={css({ flex: 1, paddingRight: "1rem" })}>
                  Replying to {}
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

const ChannelHeader = ({ channelId }) => {
  const channel = useChannel(channelId);

  if (channel == null) return null;

  return (
    <div css={css({ padding: "6rem 1.6rem 0", userSelect: "text" })}>
      <div
        css={(t) =>
          css({
            borderBottom: "0.1rem solid",
            borderColor: t.colors.borderLighter,
            padding: "0 0 3.2rem",
            "@media (min-width: 600px)": {
              padding: `calc(${t.messages.avatarSize} + ${t.messages.gutterSize})`,
              paddingTop: 0,
            },
          })
        }
      >
        <div>
          <h1 css={css({ lineHeight: 1.15, margin: "0 0 0.3rem" })}>
            {channel.name}
          </h1>
          <div
            css={(t) =>
              css({
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.base,
                margin: "0 0 2.6rem",
              })
            }
          >
            Created by{" "}
            <AccountPreviewPopoverTrigger userId={channel.ownerUserId} /> on{" "}
            <FormattedDate
              value={channel.createdAt}
              day="numeric"
              month="long"
            />
          </div>
        </div>
        <RichText
          blocks={channel.body}
          css={(t) =>
            css({ color: t.colors.textNormal, fontSize: t.text.sizes.large })
          }
        />
      </div>
    </div>
  );
};

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
