import { css } from "@emotion/react";

const Callout = ({ icon, children, ...props }) => (
  <aside
    css={(t) =>
      css({
        display: "flex",
        gap: "1.2rem",
        background: t.colors.backgroundSecondary,
        padding: "1rem 1.6rem",
        borderRadius: "0.3rem",
        "[data-icon]": {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "2rem",
          height: "2rem",
        },
        "@media(min-width: 600px)": {
          padding: "1.6rem",
        },
      })
    }
    {...props}
  >
    {icon != null && <div data-icon>{icon}</div>}
    <span>{children}</span>
  </aside>
);

export default Callout;
