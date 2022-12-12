import { useEnsAvatar } from "@shades/common/app";
import { useEnsAvatar as useWagmiEnsAvatar } from "wagmi";
import React from "react";
import { css } from "@emotion/react";

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
      transparent = false,
      ...props
    },
    ref
  ) => {
    const cachedEnsAvatarUrl = useEnsAvatar(walletAddress);

    const { data: fetchedEnsAvatarUrl, isLoading: isLoadingEnsAvatar } =
      useWagmiEnsAvatar({
        addressOrName: walletAddress,
        enabled:
          url == null && cachedEnsAvatarUrl == null && walletAddress != null,
      });

    const ensAvatarUrl = fetchedEnsAvatarUrl ?? cachedEnsAvatarUrl;
    const enablePlaceholder = url == null && ensAvatarUrl == null;

    const placeholderAvatarUrl = usePlaceholderAvatar(walletAddress, {
      enabled: enablePlaceholder,
      transparent,
    });

    const isLoadingPlaceholder =
      enablePlaceholder && placeholderAvatarUrl == null;

    const state =
      url != null
        ? "custom-avatar"
        : signature != null
        ? "signature"
        : isLoadingEnsAvatar || isLoadingPlaceholder
        ? "blank"
        : ensAvatarUrl != null
        ? "ens-avatar"
        : "placeholder-avatar";

    switch (state) {
      case "blank":
        return (
          <Blank
            ref={ref}
            size={size}
            background={background}
            borderRadius={borderRadius}
            {...props}
          />
        );

      case "signature":
        return (
          <div
            ref={ref}
            css={(theme) =>
              css({
                borderRadius: borderRadius ?? theme.avatars.borderRadius,
                background: background ?? theme.colors.backgroundModifierHover,
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
                background: background ?? theme.colors.backgroundModifierHover,
                height: size,
                width: size,
                objectFit: "cover",
              })
            }
            {...props}
          />
        );

      default:
        throw new Error();
    }
  }
);

const Blank = React.forwardRef(
  ({ size, background, borderRadius, ...props }, ref) => (
    <div
      ref={ref}
      css={(theme) =>
        css({
          borderRadius: borderRadius ?? theme.avatars.borderRadius,
          background: background ?? theme.colors.backgroundModifierHover,
          height: size,
          width: size,
        })
      }
      {...props}
    />
  )
);

export default Avatar;
