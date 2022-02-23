import { css } from "@emotion/react";

const baseStyles = {
  fontWeight: "400",
  lineHeight: 1,
  border: 0,
  borderRadius: "4px",
  cursor: "pointer",
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
  primary: {
    color: "white",
    background: theme.colors.primary,
    "&:hover": {
      filter: "brightness(1.1)",
    },
  },
});

const stylesBySize = {
  small: {
    fontSize: "1.3rem",
    padding: "0.8rem 1rem",
  },
};

const Button = ({
  size = "small",
  variant = "default",
  css: customStyles,
  ...props
}) => (
  <button
    type="button"
    css={(theme) => [
      css({
        ...baseStyles,
        ...stylesBySize[size],
        ...stylesByVariant(theme)[variant],
      }),
      customStyles,
    ]}
    {...props}
  />
);

export default Button;
