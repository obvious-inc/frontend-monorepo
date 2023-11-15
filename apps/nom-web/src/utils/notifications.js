const DEFAULT_ICON = "/favicon-192x192.png";

export const send = ({ title, onClick, ...options }) => {
  const notification = new Notification(title, {
    icon: DEFAULT_ICON,
    ...options,
  });

  if (onClick != null) {
    const close = () => notification.close();
    notification.onclick = () => {
      onClick({ close });
    };
  }

  return notification;
};
