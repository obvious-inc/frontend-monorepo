import { css } from "@emotion/react";

const NotificationBadge = ({ count, ...props }) => (
  <div
    css={(t) =>
      css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "hsl(359, 82.6%, 59.4%)",
        color: "white",
        height: "1.5rem",
        minWidth: "1.5rem",
        fontSize: "1rem",
        fontWeight: t.text.weights.numberBadge,
        lineHeight: 1,
        borderRadius: "0.75rem",
        padding: "0 0.4rem",
      })
    }
    {...props}
  >
    {count}
  </div>
);

export default NotificationBadge;
