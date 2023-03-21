import { css } from "@emotion/react";

const IconButton = ({ component: Component = "button", ...props }) => (
  <Component
    css={(t) =>
      css({
        width: "2.6rem",
        height: "2.6rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "0.3rem",
        background: "none",
        border: 0,
        cursor: "pointer",
        color: t.colors.textNormal,
        ":hover": {
          background: t.colors.backgroundModifierHover,
        },
      })
    }
    {...props}
  />
);

export default IconButton;
