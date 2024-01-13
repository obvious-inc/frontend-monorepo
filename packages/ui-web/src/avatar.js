import React from "react";
import { css } from "@emotion/react";

const Avatar = React.forwardRef(
  (
    {
      url,
      signature,
      signatureLength = 1,
      signatureFontSize,
      size = "2rem",
      borderRadius,
      background,
      isLoading,
      style,
      ...props
    },
    ref
  ) => {
    const sharedProps = {
      ref,
      css: (t) =>
        css({
          borderRadius: `var(--custom-border-radius, ${t.avatars.borderRadius})`,
          background: `var(--custom-background, ${t.avatars.background})`,
          width: "var(--size)",
          height: "var(--size)",
          objectFit: "cover",
        }),
      style: {
        "--size": size,
        "--custom-background": background,
        "--custom-border-radius": borderRadius,
        ...style,
      },
      ...props,
    };

    if (url != null) return <img src={url} loading="lazy" {...sharedProps} />;

    return (
      <div
        {...sharedProps}
        css={[
          sharedProps.css,
          css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }),
        ]}
      >
        {!isLoading && signature != null && (
          <div
            css={(t) =>
              css({
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textTransform: "uppercase",
                fontSize: `var(--custom-signature-font-size, 1.1rem)`,
                color: t.colors.textDimmed,
                lineHeight: 1,
              })
            }
            style={{ "--custom-signature-font-size": signatureFontSize }}
          >
            {
              // Emojis: https://dev.to/acanimal/how-to-slice-or-get-symbols-from-a-unicode-string-with-emojis-in-javascript-lets-learn-how-javascript-represent-strings-h3a
              [...String(signature)].slice(0, signatureLength)
            }
          </div>
        )}
      </div>
    );
  }
);

export default Avatar;
