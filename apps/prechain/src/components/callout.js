import { css } from "@emotion/react";

const Callout = (props) => (
  <div
    css={(t) =>
      css({
        background: t.colors.backgroundSecondary,
        padding: "1rem 1.6rem",
        borderRadius: "0.3rem",
        "@media(min-width: 600px)": {
          padding: "1.6rem",
        },
      })
    }
    {...props}
  />
);

export default Callout;
