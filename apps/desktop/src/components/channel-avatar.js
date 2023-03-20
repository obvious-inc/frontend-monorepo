import { css } from "@emotion/react";
import { useMe, useChannel, useChannelMembers } from "@shades/common/app";
import { array as arrayUtils } from "@shades/common/utils";
import Avatar from "@shades/ui-web/avatar";
import UserAvatar from "./user-avatar.js";

const { reverse } = arrayUtils;

export const ChannelMembersAvatar = ({ id, transparent, ...props }) => {
  const me = useMe();
  const memberUsers = useChannelMembers(id);
  const memberUsersExcludingMe = memberUsers.filter(
    (u) => me == null || u.id !== me.id
  );
  const isFetchingMembers = memberUsers.some((m) => m.walletAddress == null);

  if (isFetchingMembers) return <Avatar {...props} />;

  if (memberUsersExcludingMe.length <= 1) {
    const member = memberUsersExcludingMe[0] ?? memberUsers[0];
    return (
      <UserAvatar
        walletAddress={member.walletAddress}
        transparent={transparent}
        {...props}
      />
    );
  }

  return (
    <div
      style={{
        width: props.size,
        height: props.size,
        position: "relative",
      }}
    >
      {reverse(memberUsersExcludingMe.slice(0, 2)).map((user, i) => (
        <UserAvatar
          key={user.walletAddress}
          walletAddress={user.walletAddress}
          transparent={transparent}
          {...props}
          css={css({
            position: "absolute",
            top: i === 0 ? "3px" : 0,
            left: i === 0 ? "3px" : 0,
            width: "calc(100% - 3px)",
            height: "calc(100% - 3px)",
            boxShadow: i !== 0 ? `1px 1px 0 0px rgb(0 0 0 / 30%)` : undefined,
          })}
        />
      ))}
    </div>
  );
};

const ChannelAvatar = ({ id, transparent, ...props }) => {
  const channel = useChannel(id);

  if (channel == null) return <Avatar {...props} />;
  if (channel.image != null) return <Avatar url={channel.image} {...props} />;
  if (channel.kind === "dm")
    return (
      <ChannelMembersAvatar id={id} transparent={transparent} {...props} />
    );

  return <Avatar signature={channel.name} {...props} />;
};

export default ChannelAvatar;
