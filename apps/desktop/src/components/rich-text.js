import { Link } from "react-router-dom";
import { useUser } from "@shades/common/app";
import RichTextBase from "@shades/ui-web/rich-text";
import Emoji from "@shades/ui-web/emoji";
import InlineUserButton from "@shades/ui-web/inline-user-button";
import InlineChannelButton from "@shades/ui-web/inline-channel-button";
import * as Popover from "@shades/ui-web/popover";
import ProfilePreview from "./profile-preview.js";

const UserMention = ({ id }) => {
  const user = useUser(id);

  if (user == null) return null;

  return (
    <Popover.Root placement="right">
      <Popover.Trigger asChild disabled={user.deleted}>
        <InlineUserButton variant="button" userId={user.id} />
      </Popover.Trigger>
      <Popover.Content>
        <ProfilePreview userId={id} />
      </Popover.Content>
    </Popover.Root>
  );
};

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
