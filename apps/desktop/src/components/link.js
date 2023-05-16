import { css } from "@emotion/react";

const Link = ({
  underline,
  component: Component = "button",
  style,
  ...props
}) => (
  <Component
    css={(t) =>
      css({
        color: t.colors.link,
        textDecoration: "var(--text-decoration, none)",
        outline: "none",
        ":focus-visible": {
          textDecoration: "underline",
          color: t.colors.linkModifierHover,
        },
        "@media(hover: hover)": {
          cursor: "pointer",
          ":hover": {
            textDecoration: "underline",
            color: t.colors.linkModifierHover,
          },
        },
      })
    }
    style={{
      "--text-decoration": underline ? "underline" : undefined,
      ...style,
    }}
    {...props}
  />
);

export default Link;
