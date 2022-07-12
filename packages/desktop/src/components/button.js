import { css } from "@emotion/react";

const baseStyles = () => ({
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
  "&[disabled]": { opacity: 0.5 },
});

const stylesByVariant = (theme) => ({
  default: {
    color: theme.colors.textNormal,
    border: "1px solid rgba(255, 255, 255, 0.13)",
    // background: "rgb(255 255 255 / 7%)",
    "&:hover": {
      // background: "rgb(255 255 255 / 9%)",
      background: "rgb(47 47 47)",
    },
  },
  transparent: {
    color: theme.colors.textNormal,
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
    background: theme.colors.primary,
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
    // fontSize: "1.3rem",
    padding: "0 1rem",
    height: "2.8rem",
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

const Button = ({
  size = "small",
  variant = "default",
  fullWidth = false,
  css: customStyles,
  component: Component = "button",
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
    style={{ width: fullWidth ? "100%" : undefined }}
    {...props}
  />
);

export default Button;
