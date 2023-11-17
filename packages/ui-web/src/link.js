import { css } from "@emotion/react";

const Link = ({
  underline = false,
  color,
  hoverColor,
  component: Component = "button",
  style,
  ...props
}) => (
  <Component
    css={(t) =>
      css({
        color: `var(--color, ${t.colors.link})`,
        textDecoration: "var(--text-decoration, none)",
        outline: "none",
        ":focus-visible": {
          textDecoration: "underline",
          color: `var(--color, ${t.colors.linkModifierHover})`,
        },
        "@media(hover: hover)": {
          cursor: "pointer",
          ":hover": {
            textDecoration: "underline",
            color: `var(--hover-color, ${t.colors.linkModifierHover})`,
          },
        },
      })
    }
    style={{
      "--text-decoration": underline ? "underline" : undefined,
      "--color": color,
      "--hover-color": hoverColor,
      ...style,
    }}
    {...props}
  />
);

export default Link;
