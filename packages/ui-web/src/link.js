import { css } from "@emotion/react";

const Link = ({
  underline = false,
  variant = "regular",
  component: Component = "button",
  size,
  ...props
}) => {
  return (
    <Component
      data-size={size}
      data-variant={variant}
      data-underline={underline || undefined}
      css={(t) =>
        css({
          color: "inherit",
          outline: "none",
          textDecoration: "none",
          '&[data-size="small"]': { fontSize: t.text.sizes.small },
          "&[data-underline]": { textDecoration: "underline" },
          '&[data-variant="regular"]': { color: t.colors.link },
          '&[data-variant="dimmed"]': { color: t.colors.textDimmed },
          ":focus-visible": { textDecoration: "underline" },
          "@media(hover: hover)": {
            cursor: "pointer",
            ":hover": {
              textDecoration: "underline",
              '&[data-variant="regular"]': {
                color: t.colors.linkModifierHover,
              },
              '&[data-variant="dimmed"]': {
                color: t.colors.textDimmedModifierHover,
              },
            },
          },
        })
      }
      {...props}
    />
  );
};

export default Link;
