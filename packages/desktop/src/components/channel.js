import React from "react";
import { useParams } from "react-router";
import { css } from "@emotion/react";
import { FormattedDate } from "react-intl";
import usePageVisibilityChangeListener from "../hooks/page-visibility-change-listener";
import useAppScope from "../hooks/app-scope";
import { useAuth } from "@shades/common";

const useChannelMessages = (channelId) => {
  const { actions, state } = useAppScope();

  const messages = state.selectChannelMessages(channelId);

  React.useEffect(() => {
    actions.fetchMessages({ channelId });
  }, [actions, channelId]);

  usePageVisibilityChangeListener((state) => {
    if (state !== "visible") return;
    actions.fetchMessages({ channelId });
  });

  const sortedMessages = messages.sort(
    (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
  );

  return sortedMessages;
};

const Channel = () => {
  const params = useParams();
  const { user } = useAuth();
  const { actions, state } = useAppScope();

  const inputRef = React.useRef();

  const selectedServer = state.selectServer(params.serverId);
  const serverChannels = selectedServer?.channels ?? [];
  const selectedChannel = serverChannels.find((c) => c.id === params.channelId);
  const serverMembersByUserId = state.selectServerMembersByUserId(
    params.serverId
  );

  const messages = useChannelMessages(params.channelId);

  const lastMessage = messages.slice(-1)[0];

  // Fetch messages when switching channels
  React.useEffect(() => {
    let didChangeChannel = false;

    actions.fetchMessages({ channelId: params.channelId }).then((messages) => {
      // Mark empty channels as read
      if (didChangeChannel || messages.length !== 0) return;
      actions.markChannelRead({ channelId: params.channelId });
    });

    return () => {
      didChangeChannel = true;
    };
  }, [actions, params.channelId]);

  // Make channels as read as new messages arrive
  React.useEffect(() => {
    if (lastMessage?.id == null || lastMessage.author === user.id) return;
    actions.markChannelRead({ channelId: params.channelId });
  }, [
    lastMessage?.id,
    lastMessage?.author,
    user.id,
    params.channelId,
    actions,
  ]);

  React.useEffect(() => {
    if (selectedChannel?.id == null) return;
    inputRef.current.focus();
  }, [selectedChannel?.id]);

  usePageVisibilityChangeListener((state) => {
    if (state === "visible") return;
    actions.fetchUserData();
  });

  if (selectedChannel == null) return null;

  return (
    <div
      css={css`
        flex: 1;
        background: rgb(255 255 255 / 3%);
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      `}
    >
      <div
        css={css`
          overflow: auto;
          font-size: 1.3rem;
          font-weight: 300;
          padding: 1.6rem 0 0;
          overscroll-behavior-y: contain;
          scroll-snap-type: y proximity;
        `}
      >
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            content={m.content}
            author={serverMembersByUserId[m.author].display_name}
            timestamp={
              <FormattedDate
                value={new Date(m.created_at)}
                hour="numeric"
                minute="numeric"
                day="numeric"
                month="short"
              />
            }
          />
        ))}
        <div
          css={css`
            height: 1.6rem;
            scroll-snap-align: end;
          `}
        />
      </div>
      <NewMessageInput
        ref={inputRef}
        submit={(content) =>
          actions.createMessage({
            server: params.serverId,
            channel: params.channelId,
            content,
          })
        }
        placeholder={
          selectedChannel == null ? "..." : `Message #${selectedChannel.name}`
        }
      />
    </div>
  );
};

const MessageItem = ({ author, content, timestamp }) => (
  <div
    css={css`
      line-height: 1.6;
      padding: 0.7rem 1.6rem 0.5rem;
      user-select: text;
      &:hover {
        background: rgb(0 0 0 / 15%);
      }
    `}
  >
    <div
      css={css`
        display: grid;
        grid-template-columns: repeat(2, minmax(0, auto));
        justify-content: flex-start;
        align-items: flex-end;
        grid-gap: 1.2rem;
        margin: 0 0 0.4rem;
        cursor: default;
      `}
    >
      <div
        css={css`
          line-height: 1.2;
          color: #e588f8;
          font-weight: 500;
        `}
      >
        {author}
      </div>
      <div
        css={css`
          color: rgb(255 255 255 / 30%);
          font-size: 1rem;
        `}
      >
        {timestamp}
      </div>
    </div>
    <div
      css={css`
        white-space: pre-wrap;
      `}
    >
      {content}
    </div>
  </div>
);

const NewMessageInput = React.forwardRef(
  ({ submit: submit_, placeholder }, ref) => {
    const formRef = React.useRef();
    const [pendingMessage, setPendingMessage] = React.useState("");

    const submit = async () => {
      submit_(pendingMessage);
      setPendingMessage("");
    };

    return (
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        css={css`
          padding: 0 1.6rem 1.6rem;
        `}
      >
        <textarea
          ref={ref}
          rows={1}
          value={pendingMessage}
          onChange={(e) => setPendingMessage(e.target.value)}
          style={{
            font: "inherit",
            fontSize: "1.3rem",
            padding: "1.4rem 1.6rem",
            background: "rgb(255 255 255 / 4%)",
            color: "white",
            border: 0,
            borderRadius: "0.5rem",
            outline: "none",
            display: "block",
            width: "100%",
            resize: "none",
          }}
          placeholder={placeholder}
          onKeyPress={(e) => {
            if (!e.shiftKey && e.key === "Enter") {
              e.preventDefault();
              if (pendingMessage.trim().length === 0) return;
              submit();
            }
          }}
        />
        <input
          type="submit"
          hidden
          disabled={pendingMessage.trim().length === 0}
        />
      </form>
    );
  }
);

export default Channel;
