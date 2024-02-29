import React from "react";
import { css } from "@emotion/react";

const InlineButton = React.forwardRef(
  ({ variant = "button", component = "button", disabled, ...props }, ref) => {
    const additionalProps = !disabled
      ? {}
      : component === "button"
        ? { disabled }
        : { "data-disabled": true };

    const mergedProps = {
      component,
      ...props,
      ...additionalProps,
    };

    if (variant === "link") return <Link ref={ref} {...mergedProps} />;

    return <Button ref={ref} {...mergedProps} />;
  },
);

const Link = React.forwardRef(
  ({ component: Component = "button", ...props }, ref) => (
    <Component
      ref={ref}
      css={(t) =>
        css({
          display: "inline",
          lineHeight: "inherit",
          fontSize: "inherit",
          color: "inherit",
          // color: props.disabled ? t.colors.textDimmed : t.colors.textNormal,
          fontWeight: t.text.weights.emphasis,
          outline: "none",
          textDecoration: "none",
          ":not([disabled])": {
            cursor: "pointer",
          },
          ":not([disabled]):focus-visible": {
            textDecoration: "underline",
          },
          "@media(hover: hover)": {
            ":not([disabled]):hover": {
              textDecoration: "underline",
            },
          },
        })
      }
      {...props}
    />
  ),
);

const Button = React.forwardRef(
  ({ component: Component = "button", ...props }, ref) => (
    <Component
      ref={ref}
      css={(t) =>
        css({
          display: "inline-block",
          border: 0,
          lineHeight: "inherit",
          borderRadius: "0.3rem",
          padding: "0 0.2rem",
          fontWeight: t.text.weights.smallHeader,
          outline: "none",
          textDecoration: "none",
          color: t.colors.mentionText,
          background: t.colors.mentionBackground,
          "&[disabled], &[data-disabled]": {
            color: t.colors.textDimmed,
            background: t.colors.backgroundModifierHover,
            pointerEvents: "none",
          },
          ":not([disabled], [data-disabled])": {
            cursor: "pointer",
            "&[data-focused], :focus-visible": {
              position: "relative",
              zIndex: 1,
              boxShadow: `0 0 0 0.2rem ${t.colors.mentionFocusBorder}`,
            },
          },
          "@media(hover: hover)": {
            ":hover": { textDecoration: "none" },
            ":not([disabled], [data-disabled]):hover": {
              color: t.colors.mentionTextModifierHover,
              background: t.colors.mentionBackgroundModifierHover,
            },
          },
        })
      }
      {...props}
    />
  ),
);

export default InlineButton;
