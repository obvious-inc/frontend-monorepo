import React from "react";
import { css } from "@emotion/react";
import { emoji as emojiUtils } from "@shades/common/utils";
import { useEmojiById } from "@shades/common/app";

const Emoji = React.forwardRef(({ large, emoji, children, ...props }, ref) => {
  const emojiItem = useEmojiById(emoji);
  const isPictogram = emojiItem?.emoji != null || emojiUtils.isEmoji(emoji);
  return (
    <span
      ref={ref}
      css={(t) =>
        css({
          display: "inline-flex",
          width: large ? "calc(1.46668em * 1.45)" : "1.46668em",
          height: large ? "calc(1.46668em * 1.45)" : "1.46668em",
          overflow: "hidden",
          verticalAlign: "bottom",
          "[data-container]": {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            fontSize: "1.3em",
          },
          '&[data-size="large"] [data-container]': {
            fontSize: "2em",
          },
          img: {
            width: "1em",
            height: "1em",
            borderRadius: "0.3rem",
            objectFit: "cover",
          },
          "[data-fallback]": {
            width: "1em",
            height: "1em",
            borderRadius: "0.3rem",
            background: t.colors.backgroundModifierNormal,
          },
        })
      }
      data-size={large ? "large" : undefined}
      {...props}
    >
      <span data-container>
        {isPictogram ? (
          emoji
        ) : emojiItem?.url != null ? (
          <img src={emojiItem.url} loading="lazy" />
        ) : (
          <div data-fallback />
        )}
      </span>
      {children}
    </span>
  );
});

export default Emoji;
