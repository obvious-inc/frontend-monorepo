import { useEnsAvatar } from "wagmi";
import React from "react";
import { css } from "@emotion/react";
import { generatePlaceholderAvatarDataUri } from "@shades/common";

const usePlaceholderAvatar = (walletAddress, { enabled = true } = {}) => {
  const [generatedPlaceholderAvatarUrl, setGeneratedPlaceholderAvatarUrl] =
    React.useState(null);

  React.useEffect(() => {
    if (!enabled || walletAddress == null) return;
    generatePlaceholderAvatarDataUri(walletAddress).then((url) => {
      setGeneratedPlaceholderAvatarUrl(url);
    });
  }, [enabled, walletAddress]);

  return generatedPlaceholderAvatarUrl;
};

const Avatar = React.forwardRef(
  (
    {
      url,
      walletAddress,
      signature,
      size = "2rem",
      pixelSize, // eslint-disable-line
      borderRadius,
      background,
      ...props
    },
    ref
  ) => {
    const placeholderAvatarUrl = usePlaceholderAvatar(walletAddress, {
      enabled: url == null,
    });

    const { data: ensAvatarUrl, isLoading: isLoadingEnsAvatar } = useEnsAvatar({
      addressOrName: walletAddress,
      enabled: url == null && walletAddress != null,
    });

    const state =
      url != null
        ? "custom-avatar"
        : signature != null
        ? "signature"
        : isLoadingEnsAvatar || placeholderAvatarUrl == null
        ? "blank"
        : ensAvatarUrl != null
        ? "ens-avatar"
        : "placeholder-avatar";

    switch (state) {
      case "blank":
        return (
          <Blank ref={ref} size={size} borderRadius={borderRadius} {...props} />
        );

      case "signature":
        return (
          <div
            ref={ref}
            css={(theme) =>
              css({
                borderRadius: borderRadius ?? theme.avatars.borderRadius,
                background: theme.colors.backgroundModifierHover,
                height: size,
                width: size,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              })
            }
            {...props}
          >
            <div
              css={(theme) =>
                css({
                  textTransform: "uppercase",
                  fontSize: "1.1rem",
                  color: theme.colors.textDimmed,
                })
              }
            >
              {signature}
            </div>
          </div>
        );

      case "custom-avatar":
      case "ens-avatar":
      case "placeholder-avatar":
        return (
          <img
            ref={ref}
            src={url ?? ensAvatarUrl ?? placeholderAvatarUrl}
            loading="lazy"
            css={(theme) =>
              css({
                borderRadius: borderRadius ?? theme.avatars.borderRadius,
                background: theme.colors.backgroundSecondary,
                height: size,
                width: size,
                objectFit: "cover",
              })
            }
            style={{ background }}
            {...props}
          />
        );

      default:
        throw new Error();
    }
  }
);

const Blank = React.forwardRef(({ size, borderRadius, ...props }, ref) => (
  <div
    ref={ref}
    css={(theme) =>
      css({
        borderRadius: borderRadius ?? theme.avatars.borderRadius,
        background: theme.colors.backgroundModifierHover,
        height: size,
        width: size,
      })
    }
    {...props}
  />
));

export default Avatar;
