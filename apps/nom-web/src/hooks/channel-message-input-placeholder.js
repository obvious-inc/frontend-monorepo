import { useAccount } from "wagmi";
import {
  useAuth,
  useMe,
  useChannel,
  useChannelAccessLevel,
} from "@shades/common/app";

const useMessageInputPlaceholder = (channelId) => {
  const { address: walletAccountAddress } = useAccount();

  const { status: authenticationStatus } = useAuth();

  const me = useMe();
  const channel = useChannel(channelId, { name: true, members: true });
  const channelAccessLevel = useChannelAccessLevel(channelId);

  if (channelId == null) return null;
  if (channel == null) return "...";

  if (channel.kind === "dm") return `Message ${channel.name}`;

  const hasConnectedWallet = walletAccountAddress != null;
  const isAuthenticated = authenticationStatus === "authenticated";
  const isMember = me != null && channel.memberUserIds.includes(me.id);

  switch (channelAccessLevel) {
    case "private":
      return `Message #${channel.name}`;

    case "closed": {
      if (isAuthenticated)
        return isMember
          ? `Message #${channel.name}`
          : `Only members can post in #${channel.name}`;

      if (!hasConnectedWallet) return "Connect wallet to chat";

      const walletAddressIsMember = channel.members?.some(
        (m) =>
          m.walletAddress != null &&
          m.walletAddress.toLowerCase() === walletAccountAddress.toLowerCase(),
      );

      return walletAddressIsMember
        ? "Verify account to chat"
        : `Only members can post in #${channel.name}`;
    }

    case "open": {
      if (isAuthenticated) return `Message #${channel.name}`;
      return hasConnectedWallet
        ? "Verify account to chat"
        : "Connect wallet to chat";
    }

    default:
      return isMember ? `Message #${channel.name}` : "";
  }
};

export default useMessageInputPlaceholder;
