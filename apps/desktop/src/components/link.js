import { css } from "@emotion/react";

const Link = ({ component: Component = "button", ...props }) => (
  <Component
    css={(t) =>
      css({
        color: t.colors.link,
        textDecoration: "none",
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
    {...props}
  />
);

export default Link;
