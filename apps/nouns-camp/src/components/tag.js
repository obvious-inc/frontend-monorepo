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
        background: t.colors.backgroundModifierNormal,
        color: t.colors.textDimmed,
        fontSize: t.text.sizes.micro,
        fontWeight: t.text.weights.smallTextEmphasis,
        textTransform: "uppercase",
        padding: "0.1em 0.3em",
        borderRadius: "0.2rem",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        '&[data-size="large"]': { padding: "0.3em 0.5em" },
        '&[data-variant="active"]': {
          color: t.colors.textPrimary,
          background: t.colors.textPrimaryBackgroundLight,
        },
        '&[data-variant="success"]': {
          color: t.colors.textPositiveContrast,
          background: t.colors.textPositiveContrastBackgroundLight,
        },
        '&[data-variant="error"]': {
          color: t.colors.textNegativeContrast,
          background: t.colors.textNegativeContrastBackgroundLight,
        },
        '&[data-variant="special"]': {
          color: t.colors.textSpecialContrast,
          background: t.colors.textSpecialContrastBackgroundLight,
        },
        '&[data-active="true"]': {
          boxShadow: t.shadows.focusSmall,
        },
        "@media(min-width: 600px)": {
          '&[data-size="large"])': {
            fontSize: t.text.sizes.tiny,
          },
        },
      })
    }
    {...props}
  />
);

export default Tag;
