import { css } from "@emotion/react";

const NotificationBadge = ({ count, hasImportant = false, ...props }) => (
  <div
    css={(theme) =>
      css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hasImportant
          ? "hsl(359, 82.6%, 59.4%)"
          : theme.colors.backgroundTertiary,
        color: hasImportant ? "white" : theme.colors.textMuted,
        height: "1.5rem",
        minWidth: "1.5rem",
        fontSize: "1rem",
        fontWeight: theme.text.weights.notificationBadge,
        lineHeight: 1,
        borderRadius: "0.75rem",
        padding: "0 0.4rem",
      })
    }
    {...props}
  >
    {count >= 10 ? "10+" : count}
  </div>
);

export default NotificationBadge;
