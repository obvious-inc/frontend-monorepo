import { css } from "@emotion/react";

const baseStyles = {
  fontWeight: "400",
  lineHeight: 1.2,
  border: 0,
  borderRadius: "4px",
  cursor: "pointer",
  textAlign: "center",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  "&[disabled]": { opacity: 0.5 },
};

const stylesByVariant = (theme) => ({
  default: {
    color: theme.colors.textNormal,
    background: "rgb(255 255 255 / 7%)",
    "&:hover": {
      background: "rgb(255 255 255 / 9%)",
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

const stylesBySize = {
  default: {
    fontSize: "1.4rem",
    padding: "0.8rem 1.5rem",
    minHeight: "3.6rem",
  },
  small: {
    fontSize: "1.3rem",
    padding: "0.8rem 1rem",
  },
  large: {
    fontSize: "1.5rem",
    padding: "1.2rem 2rem",
  },
};

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
        ...baseStyles,
        ...stylesBySize[size],
        ...stylesByVariant(theme)[variant],
      }),
      customStyles,
    ]}
    style={{ width: fullWidth ? "100%" : undefined }}
    {...props}
  />
);

export default Button;
