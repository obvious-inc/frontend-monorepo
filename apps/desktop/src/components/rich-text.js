import { Link } from "react-router-dom";
import RichTextBase from "@shades/ui-web/rich-text";
import Emoji from "@shades/ui-web/emoji";
import InlineChannelButton from "@shades/ui-web/inline-channel-button";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";

const UserMention = ({ id }) => (
  <AccountPreviewPopoverTrigger userId={id} variant="button" />
);

const RichText = ({ blocks, ...props }) => {
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
            return (
              <InlineChannelButton
                key={i}
                channelId={el.ref}
                component={Link}
                to={`/channels/${el.ref}`}
              />
            );

          case "user":
            return <UserMention key={i} id={el.ref} />;

          default:
            return null;
        }
      }}
      {...props}
    />
  );
};

export default RichText;
