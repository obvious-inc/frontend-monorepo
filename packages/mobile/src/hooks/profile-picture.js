import Constants from "expo-constants";
import { decode as decodeBase64 } from "base-64";
import React from "react";
import { useEnsAvatar } from "wagmi";
import * as Shades from "@shades/common";

const { generatePlaceholderAvatarSvgString } = Shades.nouns;

const CLOUDFLARE_ACCOUNT_HASH =
  Constants.expoConfig.extra.cloudflareAccountHash;

const usePlaceholderAvatarSvg = (walletAddress, { enabled = true } = {}) => {
  const [generatedPlaceholderAvatar, setGeneratedPlaceholderAvatar] =
    React.useState(null);

  React.useEffect(() => {
    if (!enabled || walletAddress == null) return;
    generatePlaceholderAvatarSvgString(walletAddress).then((url) => {
      setGeneratedPlaceholderAvatar(url);
    });
  }, [enabled, walletAddress]);

  return generatedPlaceholderAvatar;
};

const useProfilePicture = (user, { large } = {}) => {
  const customUrl =
    user == null
      ? null
      : user.profilePicture.cloudflareId == null
      ? user.profilePicture.small
      : `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_HASH}/${
          user.profilePicture.cloudflareId
        }/${large ? "public" : "avatar"}`;

  const { data: ensAvatarUrl, isLoading: isLoadingEnsAvatar } = useEnsAvatar({
    addressOrName: user?.walletAddress,
    enabled: customUrl == null && user?.walletAddress != null,
  });

  const placeholderSvgString = usePlaceholderAvatarSvg(user?.walletAddress, {
    enabled:
      customUrl == null && !isLoadingEnsAvatar && user?.walletAddress != null,
  });

  const avatarUrl = customUrl ?? ensAvatarUrl;

  const svgDataUrlPrefix = "data:image/svg+xml;base64,";
  const isSvgDataUrl = avatarUrl?.startsWith(svgDataUrlPrefix);

  if (isSvgDataUrl)
    return {
      type: "svg-string",
      string: decodeBase64(avatarUrl.slice(svgDataUrlPrefix.length)),
    };

  const type =
    avatarUrl != null
      ? "url"
      : placeholderSvgString != null
      ? "svg-string"
      : null;

  switch (type) {
    case "url":
      return { type, url: avatarUrl };
    case "svg-string":
      return { type, string: placeholderSvgString };
    default:
      return null;
  }
};

export default useProfilePicture;
