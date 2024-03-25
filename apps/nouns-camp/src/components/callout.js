import { css } from "@emotion/react";

const Callout = ({ icon, compact, variant, children, ...props }) => (
  <aside
    data-variant={variant}
    data-compact={compact}
    css={(t) =>
      css({
        display: "flex",
        gap: "1.2rem",
        background: t.colors.backgroundModifierNormal,
        padding: "1rem 1.6rem",
        borderRadius: "0.3rem",
        '&[data-variant="error"]': {
          color: t.colors.textDanger,
        },
        '&[data-variant="info"]': {
          background: t.colors.backgroundModifierSelected,
        },
        "[data-icon]": {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "2rem",
          height: "2rem",
        },
        "[data-main]": { minWidth: 0, flex: 1 },
        "p + p": { marginTop: "1em" },
        "&[data-compact] p + p": { marginTop: "0.5em" },
        em: {
          fontStyle: "normal",
          fontWeight: t.text.weights.emphasis,
        },
        "@media(min-width: 600px)": {
          padding: "1.6rem",
        },
      })
    }
    {...props}
  >
    {icon != null && <div data-icon>{icon}</div>}
    <div data-main>{children}</div>
  </aside>
);

export default Callout;
