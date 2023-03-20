import React from "react";
import { css } from "@emotion/react";

const Avatar = React.forwardRef(
  (
    {
      url,
      signature,
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
              [...signature][0]
            }
          </div>
        )}
      </div>
    );
  }
);

export default Avatar;
