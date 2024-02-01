import React from "react";
import { css } from "@emotion/react";
import useFarcasterAccount from "./farcaster-account";
import {
  useNotificationLastSeenAt,
  useNotificationsBadge,
  useNotificationsContext,
  useSortedByDateNotificationsByFid,
} from "../hooks/notifications";
import NotificationItem from "./notification";
import { usePreviousValue } from "../hooks/previous-value";
import NotificationsNavBar from "./notifications-navbar";

const NotificationsView = () => {
  const notificationsContainerRef = React.useRef();
  const scrollContainerRef = React.useRef();

  const { fid } = useFarcasterAccount();
  const notifications = useSortedByDateNotificationsByFid(fid);
  const { count: unseenNotifsCount } = useNotificationsBadge(fid);

  const {
    actions: { markNotificationsRead },
  } = useNotificationsContext();

  const notifsLastSeenAt = useNotificationLastSeenAt(fid);
  const prevNotifsLastSeenAt = usePreviousValue(notifsLastSeenAt);

  React.useEffect(() => {
    if (
      !fid ||
      // Only mark as read when the page has focus
      !document.hasFocus() ||
      // If no notifications, ignore
      unseenNotifsCount == 0
    )
      return;

    markNotificationsRead({ fid });
  }, [fid, markNotificationsRead, unseenNotifsCount]);

  return (
    <div
      css={(t) =>
        css({
          position: "relative",
          zIndex: 0,
          flex: 1,
          minWidth: "min(30.6rem, 100vw)",
          background: t.colors.backgroundPrimary,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "auto",
        })
      }
    >
      <NotificationsNavBar />

      <div
        css={css({
          position: "relative",
          flex: 1,
          display: "flex",
          minHeight: 0,
          minWidth: 0,
        })}
      >
        <div
          ref={scrollContainerRef}
          css={css({
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            minHeight: 0,
            flex: 1,
            overflowAnchor: "none",
          })}
        >
          <div
            css={css({
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "stretch",
              minHeight: "100%",
            })}
          >
            <div
              ref={notificationsContainerRef}
              role="list"
              css={(t) =>
                css({
                  minHeight: 0,
                  fontSize: t.text.sizes.normal,
                  fontWeight: "400",
                  "--avatar-size": t.messages.avatarSize,
                  "--gutter-size": t.messages.gutterSize,
                  "--gutter-size-compact": t.messages.gutterSizeCompact,
                  ".channel-message-container": {
                    "--color-optimistic": t.colors.textMuted,
                    "--bg-highlight":
                      t.colors.messageBackgroundModifierHighlight,
                    "--bg-focus": t.colors.messageBackgroundModifierFocus,
                    background: "var(--background, transparent)",
                    padding: "var(--padding)",
                    borderRadius: "var(--border-radius, 0)",
                    color: "var(--color, ${t.colors.textNormal})",
                    position: "relative",
                    lineHeight: 1.46668,
                    userSelect: "text",
                  },
                })
              }
            >
              {notifications && notifications.length > 0 && (
                <>
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      unseen={notification.timestamp > prevNotifsLastSeenAt}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div css={css({ height: "2rem" })}></div>
    </div>
  );
};

export default NotificationsView;
