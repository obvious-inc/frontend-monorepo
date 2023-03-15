import { css } from "@emotion/react";
import { useMe, useChannel, useChannelMembers } from "@shades/common/app";
import { array as arrayUtils } from "@shades/common/utils";
import Avatar from "./avatar.js";

const { reverse } = arrayUtils;

const ChannelMembersAvatar = ({ id, ...props }) => {
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
      <Avatar
        url={member.profilePicture?.small}
        walletAddress={member.walletAddress}
        {...props}
      />
    );
  }

  return (
    <div
      style={{
        width: `${props.size}px`,
        height: `${props.size}px`,
        position: "relative",
      }}
    >
      {reverse(memberUsersExcludingMe.slice(0, 2)).map((user, i) => (
        <Avatar
          key={user.id}
          url={user.profilePicture?.small}
          walletAddress={user.walletAddress}
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

const ChannelAvatar = ({ id, ...props }) => {
  const channel = useChannel(id);

  if (channel == null) return <Avatar {...props} />;
  if (channel.image != null) return <Avatar url={channel.image} {...props} />;
  if (channel.kind === "dm") return <ChannelMembersAvatar id={id} {...props} />;

  return (
    <Avatar
      // Emojis: https://dev.to/acanimal/how-to-slice-or-get-symbols-from-a-unicode-string-with-emojis-in-javascript-lets-learn-how-javascript-represent-strings-h3a
      signature={channel.name == null ? null : [...channel.name][0]}
      {...props}
    />
  );
};

export default ChannelAvatar;
