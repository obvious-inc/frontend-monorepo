import React from "react";
import { useParams } from "react-router-dom";
import { css } from "@emotion/react";
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
  useStringifiedMessageContent,
} from "@shades/common/app";
import {
  useLatestCallback,
  useWindowFocusOrDocumentVisibleListener,
  useWindowOnlineListener,
  useMatchMedia,
} from "@shades/common/react";
import { message as messageUtils } from "@shades/common/utils";
import Button from "@shades/ui-web/button";
import Input from "@shades/ui-web/input";
import ChannelMessagesScrollView from "@shades/ui-web/channel-messages-scroll-view";
import ChannelMessage from "./channel-message.js";
import RichText from "./rich-text.js";
// import { isNodeEmpty } from "../slate/utils.js";
// import NewChannelMessageInput from "./new-channel-message-input.js";

const ChannelContent = ({ channelId }) => {
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

  // const submitMessage = useLatestCallback(async (blocks) => {
  //   setReplyTargetMessageId(null);

  //   if (me == null) {
  //     if (
  //       !confirm(
  //         "You need to verify your account to post. Sign in with your wallet to proceed."
  //       )
  //     )
  //       return;

  //     await login(walletAccountAddress);
  //     await actions.fetchMe();

  //     if (
  //       !confirm("Your account has been verified. Do you still wish to post?")
  //     )
  //       return;
  //   }

  //   if (channel.memberUserIds != null && !channel.memberUserIds.includes(me.id))
  //     await actions.joinChannel(channelId);

  //   return actions.createMessage({
  //     channel: channelId,
  //     blocks,
  //     replyToMessageId: replyTargetMessageId,
  //   });
  // });

  // const throttledRegisterTypingActivity = React.useMemo(
  //   () =>
  //     throttle(() => actions.registerChannelTypingActivity(channelId), 3000, {
  //       trailing: false,
  //     }),
  //   [actions, channelId]
  // );

  // const handleInputChange = useLatestCallback((blocks) => {
  //   if (me == null) return;
  //   if (blocks.length === 0 || isNodeEmpty(blocks[0])) return;
  //   throttledRegisterTypingActivity();
  // });

  const initReply = useLatestCallback((targetMessageId) => {
    setReplyTargetMessageId(
      targetMessageId === replyTargetMessageId ? null : targetMessageId
    );
    inputRef.current.focus();
  });

  // const cancelReply = React.useCallback(() => {
  //   setReplyTargetMessageId(null);
  //   inputRef.current.focus();
  // }, []);

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

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const inputElement = e.target.elements["message-content"];

          if (
            channel.memberUserIds != null &&
            !channel.memberUserIds.includes(me.id)
          )
            await actions.joinChannel(channelId);

          actions.createMessage({
            channel: channelId,
            blocks: messageUtils.parseString(inputElement.value),
            replyToMessageId: replyTargetMessageId,
          });
          inputElement.value = "";
          inputElement.style.height = "inherit";
          inputElement.focus();
        }}
        style={{ width: "100%", padding: "0 1.5rem 1.5rem" }}
      >
        {replyTargetMessage != null && (
          <div
            style={{
              padding: "0.5rem 0",
              fontSize: "0.75em",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            Reply to:{" "}
            <i>
              <MessageContent inline messageId={replyTargetMessageId} />
            </i>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <Input
            ref={inputRef}
            multiline
            name="message-content"
            disabled={disableInput}
            placeholder="..."
            css={css({ flex: 1, marginRight: "0.5rem" })}
          />
          {/* <NewChannelMessageInput */}
          {/*   ref={inputRef} */}
          {/*   disabled={disableInput} */}
          {/*   context={channel?.kind} */}
          {/*   channelId={channelId} */}
          {/*   replyTargetMessageId={replyTargetMessageId} */}
          {/*   cancelReply={cancelReply} */}
          {/*   uploadImage={actions.uploadImage} */}
          {/*   submit={submitMessage} */}
          {/*   placeholder={inputPlaceholder} */}
          {/*   members={channel?.members ?? []} */}
          {/*   onInputChange={handleInputChange} */}
          {/* /> */}
          <Button
            type="submit"
            size="medium"
            disabled={disableInput}
            style={{ height: "3.7rem" }}
          >
            Send
          </Button>
        </div>
      </form>
    </>
  );
};

const MessageContent = ({ inline, messageId }) => {
  const message = useMessage(messageId);

  return message.isSystemMessage ? (
    <StringifiedMessageContent messageId={messageId} />
  ) : (
    <RichText inline={inline} blocks={message.content} />
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
      style={{
        padding: "1rem 1.5rem",
        height: "4.4rem",
        display: "flex",
        alignItems: "center",
      }}
    >
      {channel?.name}
    </div>
  );
};

const StringifiedMessageContent = React.memo(({ messageId }) =>
  useStringifiedMessageContent(messageId)
);

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
