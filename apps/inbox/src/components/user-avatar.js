import React from "react";
import { useEnsAvatar as useWagmiEnsAvatar } from "wagmi";
import { useEnsAvatar, useUserWithWalletAddress } from "@shades/common/app";
import Avatar from "@shades/ui-web/avatar";

const usePlaceholderAvatar = (
  walletAddress,
  { enabled = true, transparent = false } = {}
) => {
  const [generatedPlaceholderAvatarUrl, setGeneratedPlaceholderAvatarUrl] =
    React.useState(null);

  React.useEffect(() => {
    if (!enabled || walletAddress == null) return;
    import("@shades/common/nouns").then((module) =>
      module
        .generatePlaceholderAvatarDataUri(walletAddress, { transparent })
        .then((url) => {
          setGeneratedPlaceholderAvatarUrl(url);
        })
    );
  }, [enabled, transparent, walletAddress]);

  return generatedPlaceholderAvatarUrl;
};

const UserAvatar = React.forwardRef(
  ({ walletAddress, highRes, transparent, ...props }, ref) => {
    const user = useUserWithWalletAddress(walletAddress);
    const userCustomAvatarUrl =
      user?.profilePicture?.[highRes ? "large" : "small"];
    const cachedEnsAvatarUrl = useEnsAvatar(walletAddress);

    const { data: fetchedEnsAvatarUrl, isLoading: isLoadingEnsAvatar } =
      useWagmiEnsAvatar({
        addressOrName: walletAddress,
        enabled: userCustomAvatarUrl == null && cachedEnsAvatarUrl == null,
      });

    const ensAvatarUrl = fetchedEnsAvatarUrl ?? cachedEnsAvatarUrl;

    const enablePlaceholder =
      userCustomAvatarUrl == null && ensAvatarUrl == null;

    const placeholderAvatarUrl = usePlaceholderAvatar(walletAddress, {
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
        signature={user?.displayName ?? user?.walletAddress.slice(2)}
        {...props}
      />
    );
  }
);

export default UserAvatar;
