import React from "react";
import { css } from "@emotion/react";
// import generateAvatar from "../utils/avatar-generator";

// Caching expensive avatar generation outside of react so that we can share
// between multiple component instances
const cache = new Map();

export const generateCachedAvatar = async (walletAddress) => {
  const cacheKey = walletAddress;

  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const [
    { ImageData, getNounSeedFromBlockHash, getNounData },
    { buildSVG },
    { utils },
  ] = await Promise.all([
    import("@nouns/assets"),
    import("@nouns/sdk"),
    import("ethers"),
  ]);
  const seed = getNounSeedFromBlockHash(0, utils.hexZeroPad(walletAddress, 32));
  const { parts, background } = getNounData(seed);

  const svgBinary = buildSVG(parts, ImageData.palette, background);
  const svgBase64 = btoa(svgBinary);

  const url = `data:image/svg+xml;base64,${svgBase64}`;

  cache.set(cacheKey, url);

  return url;
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
    const [generatedUrl, setGeneratedUrl] = React.useState(null);

    React.useEffect(() => {
      if (url != null || walletAddress == null) return;
      generateCachedAvatar(walletAddress).then((url) => {
        setGeneratedUrl(url);
      });
    }, [url, walletAddress]);

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

    if (url != null || generatedUrl != null)
      return (
        <img
          ref={ref}
          src={url ?? generatedUrl}
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
  }
);

export default Avatar;
