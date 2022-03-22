import React from "react";
import { css } from "@emotion/react";
import { useAppScope } from "@shades/common";
import generateAvatar from "../utils/avatar-generator";

const ServerMemberAvatar = ({
  serverMemberId,
  serverId,
  userId,
  size = "2rem",
  borderRadius = "0.3rem",
}) => {
  const { state } = useAppScope();
  const member =
    serverMemberId == null
      ? state.selectServerMemberWithUserId(serverId, userId)
      : state.selectServerMember(serverMemberId);

  const avatarDataUrl = React.useMemo(() => {
    if (member.pfpUrl != null) return;

    return generateAvatar({
      seed: member.walletAddress,
      size: 8,
      scale: 10,
    });
  }, [member.pfpUrl, member.walletAddress]);

  return (
    <img
      src={member.pfpUrl ?? avatarDataUrl}
      css={(theme) =>
        css({
          borderRadius,
          background: theme.colors.backgroundSecondary,
          height: size,
          width: size,
          objectFit: "cover",
        })
      }
    />
  );
};

export default ServerMemberAvatar;
