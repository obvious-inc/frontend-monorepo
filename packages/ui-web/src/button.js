import React from "react";
import { useButton, mergeProps } from "react-aria";
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
  "&:focus-visible": { boxShadow: t.shadows.focus },
});

const textDangerHoverModifier = "rgb(235 87 87 / 10%)";

const stylesByVariant = (t, { danger }) => ({
  default: {
    color: danger ? t.colors.textDanger : t.colors.textNormal,
    border: "1px solid",
    borderColor: danger ? t.colors.borderDanger : t.colors.borderLight,
    "@media (hover: hover)": {
      "&:not([disabled]):hover": {
        background: danger
          ? textDangerHoverModifier
          : t.colors.backgroundModifierNormal,
      },
    },
  },
  opaque: {
    color: t.colors.textNormal,
    background: t.colors.backgroundModifierNormal,
    "@media (hover: hover)": {
      "&:not([disabled]):hover": {
        color: t.colors.textAccent,
      },
    },
  },
  transparent: {
    color: danger ? t.colors.textDanger : t.colors.textNormal,
    background: "none",
    "@media (hover: hover)": {
      "&:not([disabled]):hover": {
        color: danger ? t.colors.textDanger : t.colors.textAccent,
        background: danger
          ? textDangerHoverModifier
          : t.colors.backgroundModifierNormal,
      },
    },
  },
  primary: {
    color: "white",
    background: t.colors.primary,
    "&:focus-visible": {
      boxShadow: `0 0 0 0.3rem ${t.colors.primaryTransparent}`,
    },
    "@media (hover: hover)": {
      "&:not([disabled]):hover": {
        background: t.colors.primaryModifierHover,
      },
    },
  },
});

export const heightBySize = {
  default: "3.2rem",
  tiny: "2rem",
  small: "2.8rem",
  medium: "3.6rem",
};

const stylesBySize = (theme, { multiline, align, icon }) => {
  const heightProp = multiline ? "minHeight" : "height";
  return {
    default: {
      fontSize: theme.fontSizes.base,
      padding: icon ? 0 : align === "left" ? "0 0.8rem" : "0 1.2rem",
      [heightProp]: heightBySize.default,
      width: icon ? heightBySize.default : undefined,
    },
    tiny: {
      fontSize: theme.fontSizes.small,
      padding: icon ? 0 : "0 0.4rem",
      [heightProp]: heightBySize.tiny,
      width: icon ? heightBySize.tiny : undefined,
    },
    small: {
      fontSize: theme.fontSizes.base,
      padding: [
        multiline ? "0.5rem" : 0,
        icon ? 0 : align === "left" ? "0.7rem" : "0.9rem",
      ].join(" "),
      [heightProp]: heightBySize.small,
      width: icon ? heightBySize.small : undefined,
    },
    medium: {
      fontSize: theme.text.sizes.button,
      padding: [
        multiline ? "0.7rem" : 0,
        icon ? 0 : align === "left" ? "0.9rem" : "1.7rem",
      ].join(" "),
      [heightProp]: heightBySize.medium,
      width: icon ? heightBySize.medium : undefined,
    },
    large: {
      fontSize: theme.text.sizes.button,
      padding: ["1.2rem", align === "left" ? "1.2rem" : "2rem"].join(" "),
    },
    larger: {
      fontSize: theme.text.sizes.large,
      padding: ["1.4rem", align === "left" ? "1.4rem" : "2.8rem"].join(" "),
    },
  };
};

const iconLayoutPropsBySize = {
  tiny: { size: "2rem", gutter: "0.2rem" },
  small: { size: "2.8rem", gutter: "0.6rem" },
  medium: { size: "3rem", gutter: "0.8rem" },
  large: { size: "3.2rem", gutter: "1rem" },
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
      style,
      ...props
    },
    ref,
  ) => {
    const { buttonProps } = useButton(
      {
        ...props,
        children,
        isDisabled: isDisabled ?? props.disabled,
        elementType: Component,
        onPress: onPress ?? onClick,
        onPressStart,
      },
      ref,
    );

    const iconLayout =
      iconLayoutPropsBySize[size] ?? iconLayoutPropsBySize.medium;

    return (
      <Component
        ref={ref}
        {...defaultPropsByComponent[Component]}
        css={(theme) =>
          css({
            ...baseStyles(theme, { align }),
            ...(stylesBySize(theme, {
              multiline,
              align,
              icon: icon != null && children == null,
            })[size] ?? { width: size, height: size }),
            ...stylesByVariant(theme, { danger })[variant],
          })
        }
        style={{
          pointerEvents: isLoading ? "none" : undefined,
          width: fullWidth ? "100%" : undefined,
          ...style,
        }}
        {...mergeProps(props, buttonProps)}
      >
        {icon != null && (
          <div
            aria-hidden="true"
            css={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "1.2rem",
              maxWidth: iconLayout.size,
              marginRight: children == null ? undefined : iconLayout.gutter,
            })}
          >
            {icon}
          </div>
        )}
        {children != null && (
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
        )}
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
  },
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
