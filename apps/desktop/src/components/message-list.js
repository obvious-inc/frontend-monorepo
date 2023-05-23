import React from "react";
import { css } from "@emotion/react";
import useGlobalMediaQueries from "../hooks/global-media-queries.js";
import ChannelMessage from "./channel-message.js";

const MessageList = React.forwardRef(
  (
    { messageIds, layout, initReply, replyTargetMessageId, scrollToMessage },
    ref
  ) => {
    const { inputDeviceCanHover } = useGlobalMediaQueries();
    const [touchFocusedMessageId, setTouchFocusedMessageId] =
      React.useState(null);
    return (
      <div
        ref={ref}
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
              "--bg-focus": t.colors.messageBackgroundModifierFocus,
              background: "var(--background, transparent)",
              padding: "var(--padding)",
              borderRadius: "var(--border-radius, 0)",
              color: "var(--color, ${t.colors.textNormal})",
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
        {messageIds.map((messageId, i, messageIds) => (
          <ChannelMessage
            key={messageId}
            messageId={messageId}
            previousMessageId={messageIds[i - 1]}
            hasPendingReply={replyTargetMessageId === messageId}
            initReply={initReply}
            hasTouchFocus={touchFocusedMessageId === messageId}
            giveTouchFocus={
              inputDeviceCanHover ? undefined : setTouchFocusedMessageId
            }
            layout={layout}
            scrollToMessage={scrollToMessage}
          />
        ))}
        <div css={css({ height: "1.6rem" })} />
      </div>
    );
  }
);

export default MessageList;
