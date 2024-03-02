import React from "react";
import {
  useEnsAvatar as useWagmiEnsAvatar,
  useEnsName as useWagmiEnsName,
} from "wagmi";
import { useEnsAvatar, useUserWithWalletAddress } from "@shades/common/app";
import Avatar from "./avatar.js";

const usePlaceholderAvatar = (
  walletAddress,
  { enabled = true, transparent = false } = {},
) => {
  const [generatedPlaceholderAvatarUrl, setGeneratedPlaceholderAvatarUrl] =
    React.useState(null);

  React.useEffect(() => {
    if (!enabled || walletAddress == null) return;
    import("@shades/common/nouns").then((module) => {
      const url = module.generatePlaceholderAvatarDataUri(walletAddress, {
        transparent,
      });
      setGeneratedPlaceholderAvatarUrl(url);
    });
  }, [enabled, transparent, walletAddress]);

  return generatedPlaceholderAvatarUrl;
};

const AccountAvatar = React.forwardRef(
  ({ address: accountAddress, highRes, transparent, ...props }, ref) => {
    const user = useUserWithWalletAddress(accountAddress);
    const { data: wagmiEnsName } = useWagmiEnsName({
      address: accountAddress,
      enabled: user?.ensName == null,
    });
    const userCustomAvatarUrl =
      user?.profilePicture?.[highRes ? "large" : "small"];
    const cachedEnsAvatarUrl = useEnsAvatar(accountAddress);
    const ensName = wagmiEnsName ?? user?.ensName;

    const { data: fetchedEnsAvatarUrl, isLoading: isLoadingEnsAvatar } =
      useWagmiEnsAvatar({
        name: ensName,
        enabled:
          userCustomAvatarUrl == null &&
          cachedEnsAvatarUrl == null &&
          ensName != null,
      });

    const ensAvatarUrl = fetchedEnsAvatarUrl ?? cachedEnsAvatarUrl;

    const enablePlaceholder =
      userCustomAvatarUrl == null && ensAvatarUrl == null;

    const placeholderAvatarUrl = usePlaceholderAvatar(accountAddress, {
      enabled: enablePlaceholder,
      transparent,
    });

    const isLoadingPlaceholder =
      enablePlaceholder && placeholderAvatarUrl == null;

    const imageUrl =
      userCustomAvatarUrl ?? ensAvatarUrl ?? placeholderAvatarUrl;

    return (
      <Avatar
        ref={ref}
        url={imageUrl}
        isLoading={isLoadingEnsAvatar || isLoadingPlaceholder}
        signature={user?.displayName ?? user?.walletAddress}
        {...props}
      />
    );
  },
);

export default AccountAvatar;
