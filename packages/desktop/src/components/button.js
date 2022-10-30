import { css, keyframes } from "@emotion/react";

const baseStyles = (t) => ({
  userSelect: "none",
  transition: "background 20ms ease-in",
  fontWeight: "400",
  lineHeight: 1.2,
  border: 0,
  borderRadius: "0.3rem",
  cursor: "pointer",
  textAlign: "center",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  whiteSpace: "nowrap",
  outline: "none",
  "&[disabled]": { opacity: 0.5, cursor: "not-allowed" },
  "&:focus": { boxShadow: `0 0 0 0.2rem ${t.colors.primary}` },
});

const stylesByVariant = (t) => ({
  default: {
    color: t.colors.textNormal,
    border: "1px solid rgba(255, 255, 255, 0.13)",
    "&:hover": {
      background: "rgb(47 47 47)",
    },
  },
  transparent: {
    color: t.colors.textNormal,
    border: "0.1rem solid",
    borderColor: "rgb(255 255 255 / 20%)",
    background: "none",
    "&:hover": {
      color: "white",
      borderColor: "rgb(255 255 255 / 25%)",
    },
  },
  primary: {
    color: "white",
    background: t.colors.primary,
    "&:focus": { boxShadow: `0 0 0 0.2rem ${t.colors.primaryTransparent}` },
    "&:hover": {
      filter: "brightness(1.1)",
    },
  },
});

const stylesBySize = (theme) => ({
  default: {
    fontSize: theme.fontSizes.default,
    padding: "0 1.2rem",
    height: "3.2rem",
  },
  small: {
    fontSize: theme.fontSizes.default,
    padding: "0 1rem",
    height: "2.8rem",
  },
  medium: {
    fontSize: "1.5rem",
    padding: "0 1.7rem",
    height: "3.6rem",
  },
  large: {
    fontSize: "1.5rem",
    padding: "1.2rem 2rem",
  },
});

const defaultPropsByComponent = {
  button: {
    type: "button",
  },
};

const loadingDotSize = "0.4rem";
const loadingDotCount = 3;

const Button = ({
  size = "small",
  variant = "default",
  fullWidth = false,
  isLoading = false,
  css: customStyles,
  component: Component = "button",
  children,
  ...props
}) => (
  <Component
    {...defaultPropsByComponent[Component]}
    css={(theme) => [
      css({
        ...baseStyles(theme),
        ...stylesBySize(theme)[size],
        ...stylesByVariant(theme)[variant],
      }),
      customStyles,
    ]}
    style={{
      pointerEvents: isLoading ? "none" : undefined,
      width: fullWidth ? "100%" : undefined,
    }}
    {...props}
  >
    <div style={{ visibility: isLoading ? "hidden" : undefined }}>
      {children}
    </div>
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
