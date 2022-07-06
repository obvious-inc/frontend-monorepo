import React from "react";
import { css } from "@emotion/react";
import generateAvatar from "../utils/avatar-generator";

// Caching expensive avatar generation outside of react so that we can share
// between multiple component instances
const cache = new Map();

export const generateCachedAvatar = (walletAddress, { pixelSize }) => {
  const size = 8;

  const cacheKey = [walletAddress, pixelSize, size].join("-");

  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const avatar = generateAvatar({
    seed: walletAddress,
    size,
    scale: Math.ceil((pixelSize * 2) / size),
  });

  cache.set(cacheKey, avatar);

  return avatar;
};

const Avatar = React.forwardRef(
  (
    {
      url,
      walletAddress,
      signature,
      size = "2rem",
      pixelSize = 20,
      borderRadius,
      background,
      ...props
    },
    ref
  ) => {
    const avatarDataUrl = React.useMemo(() => {
      if (url != null || walletAddress == null) return;
      return generateCachedAvatar(walletAddress, { pixelSize });
    }, [url, walletAddress, pixelSize]);

    if (url == null && signature != null)
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

    if (url === undefined)
      return (
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
      );

    return (
      <img
        ref={ref}
        src={url ?? avatarDataUrl}
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
  }
);

export default Avatar;
