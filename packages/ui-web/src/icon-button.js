import { css } from "@emotion/react";

const IconButton = ({
  component: Component = "button",
  size = "2.6rem",
  dimmed = false,
  ...props
}) => (
  <Component
    css={(t) =>
      css({
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "0.3rem",
        background: "none",
        border: 0,
        cursor: "pointer",
        color: dimmed ? t.colors.textDimmed : t.colors.textNormal,
        outline: "none",
        ":disabled": { color: t.colors.textMuted, pointerEvents: "none" },
        ":focus-visible": {
          boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
        },
        "@media (hover: hover)": {
          ":not(:disabled):hover": {
            background: t.colors.backgroundModifierHover,
          },
        },
      })
    }
    {...props}
  />
);

export default IconButton;
