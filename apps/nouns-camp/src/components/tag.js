import { css } from "@emotion/react";

const Tag = ({ variant, size = "normal", active, ...props }) => (
  <span
    data-variant={variant}
    data-size={size}
    data-active={active}
    css={(t) =>
      css({
        display: "inline-flex",
        justifyContent: "center",
        background: t.colors.backgroundModifierHover,
        color: t.colors.textDimmed,
        fontSize: t.text.sizes.micro,
        fontWeight: "400",
        textTransform: "uppercase",
        padding: "0.1rem 0.3rem",
        borderRadius: "0.2rem",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        '&[data-size="large"]': { padding: "0.3rem 0.5rem" },
        '&[data-variant="active"]': {
          color: t.colors.textPrimary,
          background: "#deedfd",
        },
        '&[data-variant="success"]': {
          color: "#097045",
          background: "#e0f1e1",
        },
        '&[data-variant="error"]': {
          color: t.colors.textNegative,
          background: "#fbe9e9",
        },
        '&[data-variant="special"]': {
          color: "#8d519d",
          background: "#f2dff7",
        },
        '&[data-active="true"]': {
          boxShadow: t.shadows.focusSmall,
        },
        "@media(min-width: 600px)": {
          fontSize: t.text.sizes.tiny,
        },
      })
    }
    {...props}
  />
);

export default Tag;
