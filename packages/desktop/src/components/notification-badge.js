import { css } from "@emotion/react";

const NotificationBadge = ({ count, ...props }) => (
  <div
    css={css({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "hsl(359, 82.6%, 59.4%)",
      color: "white",
      height: "1.6rem",
      minWidth: "1.6rem",
      fontSize: "1.2rem",
      fontWeight: "600",
      lineHeight: 1,
      borderRadius: "0.8rem",
      padding: "0 0.4rem",
    })}
    {...props}
  >
    {count}
  </div>
);

export default NotificationBadge;
