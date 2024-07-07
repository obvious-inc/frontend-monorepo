import { css, useTheme } from "@emotion/react";

const Link = ({
  underline = false,
  variant,
  color,
  hoverColor,
  component: Component = "button",
  size,
  style,
  ...props
}) => {
  const theme = useTheme();
  const customColor = typeof color === "function" ? color(theme) : color;
  return (
    <Component
      data-size={size}
      data-variant={variant}
      css={(t) =>
        css({
          color: `var(--color, ${t.colors.link})`,
          textDecoration: "var(--text-decoration, none)",
          outline: "none",
          '&[data-size="small"]': { fontSize: t.text.sizes.small },
          '&[data-variant="dimmed"]': { color: t.colors.textDimmed },
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
        "--color": customColor,
        "--hover-color": hoverColor ?? customColor,
        ...style,
      }}
      {...props}
    />
  );
};

export default Link;
