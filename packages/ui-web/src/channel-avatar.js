import { useMe, useChannel, useChannelMembers } from "@shades/common/app";
import Avatar from "./avatar.js";
import AccountAvatar from "./account-avatar.js";
import AccountAvatarStack from "./account-avatar-stack.js";

const ChannelMembersAvatar = ({ id, transparent, highRes, ...props }) => {
  const me = useMe();
  const memberUsers = useChannelMembers(id);
  const memberUsersExcludingMe = memberUsers.filter(
    (u) => me == null || u.id !== me.id,
  );
  const isFetchingMembers = memberUsers.some((m) => m.walletAddress == null);

  if (isFetchingMembers) return <Avatar {...props} />;

  if (memberUsersExcludingMe.length <= 1) {
    const member = memberUsersExcludingMe[0] ?? memberUsers[0];
    return (
      <AccountAvatar
        address={member.walletAddress}
        transparent={transparent}
        highRes={highRes}
        {...props}
      />
    );
  }

  return (
    <AccountAvatarStack
      addresses={memberUsersExcludingMe.map((u) => u.walletAddress)}
      {...props}
    />
  );
};

const ChannelAvatar = ({ id, transparent, highRes, ...props }) => {
  const channel = useChannel(id);

  if (channel == null) return <Avatar {...props} />;
  if (channel.image != null) return <Avatar url={channel.image} {...props} />;
  if (channel.kind === "dm")
    return (
      <ChannelMembersAvatar
        id={id}
        transparent={transparent}
        highRes={highRes}
        {...props}
      />
    );

  return <Avatar signature={channel.name} {...props} />;
};

export default ChannelAvatar;
