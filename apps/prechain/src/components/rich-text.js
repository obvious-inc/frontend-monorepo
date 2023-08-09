import React from "react";
import { css } from "@emotion/react";
import { Link } from "react-router-dom";
import { useUser, useChannel } from "@shades/common/app";
import RichTextBase, {
  createCss as createRichTextCss,
} from "@shades/ui-web/rich-text";
import Emoji from "@shades/ui-web/emoji";

const MarkdownHtml = React.lazy(() => import("./markdown-html.js"));

const UserMention = ({ userId }) => {
  const user = useUser(userId);

  if (user == null) return <>user:{userId}</>;

  const displayName =
    user == null || user.deleted || user.unknown
      ? `user:${userId}`
      : `@${user.computedDisplayName}`;

  return <span>{displayName}</span>;
};

const ChannelLink = ({ channelId }) => {
  const channel = useChannel(channelId, { name: true });
  return (
    <Link to={`/${channelId}`}>#{channel?.name ?? `channel:${channelId}`}</Link>
  );
};

const RichText = ({ blocks, markdownText, ...props }) => {
  if (markdownText != null)
    return (
      <MarkdownHtml
        text={markdownText}
        css={(t) => [
          createRichTextCss(t),
          css({ img: { borderRadius: "0.3rem" } }),
        ]}
      />
    );

  // Special "large emoji" case
  const renderLargeEmoji =
    !props.inline &&
    blocks.length === 1 &&
    blocks[0].children.length <= 10 &&
    blocks[0].children.every((b) => b.type === "emoji");

  if (renderLargeEmoji)
    return (
      <div>
        {blocks[0].children.map((b, i) => (
          <Emoji key={i} large emoji={b.emoji} />
        ))}
      </div>
    );

  return (
    <RichTextBase
      blocks={blocks}
      renderElement={(el, i) => {
        switch (el.type) {
          case "emoji":
            return <Emoji key={i} emoji={el.emoji} />;

          case "channel-link":
            return <ChannelLink key={i} channelId={el.ref} />;

          case "user":
            return <UserMention key={i} userId={el.ref} />;

          default:
            return null;
        }
      }}
      {...props}
    />
  );
};

export default RichText;
