import React from "react";
import { css } from "@emotion/react";

const Avatar = React.forwardRef(
  (
    {
      url,
      signature,
      signatureLength = 1,
      size = "2rem",
      borderRadius,
      background,
      isLoading,
      ...props
    },
    ref
  ) => {
    if (url != null)
      return (
        <img
          ref={ref}
          src={url}
          loading="lazy"
          css={(t) =>
            css({
              borderRadius: borderRadius ?? t.avatars.borderRadius,
              background: background ?? t.avatars.background,
              height: size,
              width: size,
              objectFit: "cover",
            })
          }
          {...props}
        />
      );

    return (
      <div
        ref={ref}
        css={(t) =>
          css({
            borderRadius: borderRadius ?? t.avatars.borderRadius,
            background: background ?? t.avatars.background,
            height: size,
            width: size,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          })
        }
        {...props}
      >
        {!isLoading && signature != null && (
          <div
            css={(theme) =>
              css({
                textTransform: "uppercase",
                fontSize: "1.1rem",
                color: theme.colors.textDimmed,
              })
            }
          >
            {
              // Emojis: https://dev.to/acanimal/how-to-slice-or-get-symbols-from-a-unicode-string-with-emojis-in-javascript-lets-learn-how-javascript-represent-strings-h3a
              [...signature].slice(0, signatureLength)
            }
          </div>
        )}
      </div>
    );
  }
);

export default Avatar;
