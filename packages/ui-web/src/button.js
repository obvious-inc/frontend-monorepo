import React from "react";
import { useButton } from "react-aria";
import { css, keyframes } from "@emotion/react";

const baseStyles = (t, { align }) => ({
  userSelect: "none",
  transition: "background 20ms ease-in",
  fontWeight: "400",
  lineHeight: 1.25,
  border: 0,
  borderRadius: "0.3rem",
  cursor: "pointer",
  textAlign: align === "left" ? "left" : "center",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: align === "left" ? "stretch" : "center",
  textDecoration: "none",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  outline: "none",
  "&[disabled]": { opacity: 0.5, cursor: "not-allowed" },
  "&:focus-visible": { boxShadow: `0 0 0 0.2rem ${t.colors.primary}` },
});

const stylesByVariant = (t, { danger }) => ({
  default: {
    color: danger ? t.colors.textDanger : t.colors.textNormal,
    border: "1px solid",
    borderColor: danger ? t.colors.borderDanger : "rgb(255 255 255 / 13%)",
    "@media (hover: hover)": {
      "&:not([disabled]):hover": {
        background: danger ? "rgb(235 87 87 / 10%)" : "rgb(47 47 47)",
      },
    },
  },
  transparent: {
    color: t.colors.textNormal,
    border: "0.1rem solid",
    borderColor: "rgb(255 255 255 / 20%)",
    background: "none",
    "@media (hover: hover)": {
      "&:not([disabled]):hover": {
        color: "white",
        borderColor: "rgb(255 255 255 / 25%)",
      },
    },
  },
  primary: {
    color: "white",
    background: t.colors.primary,
    "&:focus-visible": {
      boxShadow: `0 0 0 0.2rem ${t.colors.primaryTransparent}`,
    },
    "@media (hover: hover)": {
      "&:not([disabled]):hover": {
        background: t.colors.primaryModifierHover,
      },
    },
  },
});

const stylesBySize = (theme, { multiline, align }) => {
  const heightProp = multiline ? "minHeight" : "height";
  return {
    default: {
      fontSize: theme.fontSizes.default,
      padding: "0 1.2rem",
      [heightProp]: "3.2rem",
    },
    small: {
      fontSize: theme.fontSizes.default,
      padding: [
        multiline ? "0.5rem" : 0,
        align === "left" ? "0.7rem" : "0.9rem",
      ].join(" "),
      [heightProp]: "2.8rem",
    },
    medium: {
      fontSize: "1.5rem",
      padding: [
        multiline ? "0.7rem" : 0,
        align === "left" ? "0.9rem" : "1.7rem",
      ].join(" "),
      [heightProp]: "3.6rem",
    },
    large: {
      fontSize: "1.5rem",
      padding: ["1.2rem", align === "left" ? "1.2rem" : "2rem"].join(" "),
    },
  };
};

const defaultPropsByComponent = {
  button: {
    type: "button",
  },
};

const loadingDotSize = "0.4rem";
const loadingDotCount = 3;

const Button = React.forwardRef(
  (
    {
      size = "medium",
      variant = "default",
      danger = false,
      fullWidth = false,
      multiline,
      align = "center",
      icon,
      iconRight,
      isLoading = false,
      isDisabled,
      onClick,
      onPress,
      onPressStart,
      component: Component = "button",
      children,
      ...props
    },
    ref
  ) => {
    const { buttonProps } = useButton({
      ...props,
      children,
      isDisabled: isDisabled ?? props.disabled,
      elementType: Component,
      onPress: onPress ?? onClick,
      onPressStart,
    });

    const iconLayout = {
      small: { size: "2.8rem", gutter: "0.6rem" },
      medium: { size: "3rem", gutter: "0.8rem" },
      large: { size: "3.2rem", gutter: "1rem" },
    }[size];

    return (
      <Component
        ref={ref}
        {...defaultPropsByComponent[Component]}
        css={(theme) =>
          css({
            ...baseStyles(theme, { align }),
            ...stylesBySize(theme, { multiline, align })[size],
            ...stylesByVariant(theme, { danger })[variant],
          })
        }
        style={{
          pointerEvents: isLoading ? "none" : undefined,
          width: fullWidth ? "100%" : undefined,
        }}
        {...props}
        {...buttonProps}
      >
        {icon != null && (
          <div
            aria-hidden="true"
            css={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "1.5rem",
              maxWidth: iconLayout.size,
              marginRight: iconLayout.gutter,
            })}
          >
            {icon}
          </div>
        )}
        <div
          style={{
            visibility: isLoading ? "hidden" : undefined,
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
        >
          {children}
        </div>
        {iconRight != null && (
          <div
            aria-hidden="true"
            css={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "1.5rem",
              maxWidth: iconLayout.size,
              marginLeft: iconLayout.gutter,
            })}
          >
            {iconRight}
          </div>
        )}
        {isLoading && (
          <div
            style={{
              position: "absolute",
              display: "flex",
              visibility: isLoading ? undefined : "hidden",
            }}
          >
            {Array.from({ length: loadingDotCount }).map((_, i) => (
              <div
                key={i}
                css={css({
                  animation: dotsAnimation,
                  animationDelay: `${i / 5}s`,
                  animationDuration: "1.4s",
                  animationIterationCount: "infinite",
                  width: loadingDotSize,
                  height: loadingDotSize,
                  borderRadius: "50%",
                  background: "currentColor",
                  margin: "0 0.1rem",
                })}
              />
            ))}
          </div>
        )}
      </Component>
    );
  }
);

const dotsAnimation = keyframes({
  "0%": {
    opacity: 0.2,
  },
  "20%": {
    opacity: 1,
  },
  to: {
    opacity: 0.2,
  },
});

export default Button;
