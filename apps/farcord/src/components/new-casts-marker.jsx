import { css } from "@emotion/react";

export const NewCastsMarker = () => {
  return (
    <div
      css={(t) =>
        css({
          display: "flex",
          alignItems: "center",
          "--text-divider-gap": "2rem",
          color: t.colors.pink,
          textTransform: "uppercase",
          fontSize: t.text.sizes.small,
          fontWeight: t.text.weights.emphasis,

          ":before": {
            content: '""',
            height: "0.1rem",
            backgroundColor: t.colors.backgroundQuarternary,
            flexGrow: 1,
            marginRight: "var(--text-divider-gap)",
          },

          ":after": {
            content: '""',
            height: "0.1rem",
            backgroundColor: t.colors.backgroundQuarternary,
            flexGrow: 1,
            marginLeft: "var(--text-divider-gap)",
          },

          height: "0.1rem",
          margin: "3.5rem 0 2rem",
        })
      }
    >
      new casts
    </div>
  );
};
