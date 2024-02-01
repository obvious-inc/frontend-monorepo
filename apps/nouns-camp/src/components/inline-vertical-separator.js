import { css } from "@emotion/react";

const InlineVerticalSeparator = ({ height, color, spacing }) => (
  <span
    role="separator"
    aria-orientation="vertical"
    css={(t) =>
      css({
        position: "relative",
        margin: "0 var(--spacing, 0.6em)",
        ":before": {
          display: "inline-block",
          content: '""',
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          height: "var(--height, 1.2em)",
          width: "0.1rem",
          background: `var(--color, ${t.colors.borderLight})`,
        },
      })
    }
    style={{ "--color": color, "--height": height, "--spacing": spacing }}
  />
);

export default InlineVerticalSeparator;
