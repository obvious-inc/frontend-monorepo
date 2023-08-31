import { css } from "@emotion/react";

const Callout = (props) => (
  <div
    css={(t) =>
      css({
        background: t.colors.backgroundSecondary,
        padding: "1.6rem",
        borderRadius: "0.3rem",
      })
    }
    {...props}
  />
);

export default Callout;
