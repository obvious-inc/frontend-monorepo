import React from "react";
import { useFetch } from "@shades/common/react";
import { fetchMentionAndReplies, fetchReactionsAndRecasts } from "./neynar";
import { array as arrayUtils } from "@shades/common/utils";
export const NotificationsContext = React.createContext();

export const NotificationsContextProvider = ({ children }) => {
  const [state, setState] = React.useState(() => ({
    mentionsByFid: {},
    repliesByFid: {},
    recastsByFid: {},
    likesByFid: {},
    lastSeenByFid: {},
  }));

  const fetchNotifications = React.useCallback(async ({ fid }) => {
    fetchMentionAndReplies({ fid }).then((notifications) => {
      const notificationsByType = arrayUtils.groupBy(
        (n) => n.type,
        notifications
      );

      setState((s) => {
        return {
          ...s,
          mentionsByFid: {
            ...s.mentionsByFid,
            [fid]: notificationsByType?.["cast-mention"],
          },
          repliesByFid: {
            ...s.repliesByFid,
            [fid]: notificationsByType?.["cast-reply"],
          },
        };
      });
    });

    fetchReactionsAndRecasts({ fid }).then((notifications) => {
      const notificationsByType = arrayUtils.groupBy(
        (n) => n.reactionType,
        notifications
      );

      setState((s) => {
        return {
          ...s,
          likesByFid: {
            ...s.likesByFid,
            [fid]: notificationsByType?.["like"],
          },
          recastsByFid: {
            ...s.recastsByFid,
            [fid]: notificationsByType?.["recast"],
          },
        };
      });
    });
  }, []);

  const contextValue = React.useMemo(
    () => ({
      state,
      actions: {
        fetchNotifications,
      },
    }),
    [state, fetchNotifications]
  );

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotificationsFetch = ({ fid }) => {
  const {
    actions: { fetchNotifications },
  } = React.useContext(NotificationsContext);

  useFetch(
    () =>
      fetchNotifications({ fid }).catch((e) => {
        throw e;
      }),
    [fetchNotifications, fid]
  );
};

export const useNotificationsBadge = (fid) => {
  const {
    state: { mentionsByFid, repliesByFid, recastsByFid, likesByFid },
  } = React.useContext(NotificationsContext);

  // TODO: calculate badge count
  // red and number if mentions/replies
  // highlight if just new likes or recasts

  return { count: 1, hasImportant: true };
};

export const useNotificationsByFid = (fid) => {
  const {
    state: { mentionsByFid, repliesByFid, recastsByFid, likesByFid },
  } = React.useContext(NotificationsContext);

  useNotificationsFetch({ fid });
  return {
    mentions: mentionsByFid[fid] ?? [],
    replies: repliesByFid[fid] ?? [],
    recasts: recastsByFid[fid] ?? [],
    likes: likesByFid[fid] ?? [],
  };
};

export const useSortedByDateNotificationsByFid = (fid) => {
  const { mentions, replies, recasts, likes } = useNotificationsByFid(fid);

  const notifications = React.useMemo(() => {
    return [...mentions, ...replies, ...recasts, ...likes];
  }, [mentions, replies, recasts, likes]);

  return arrayUtils.sortBy(
    { value: (n) => n.timestamp, order: "desc" },
    notifications
  );
};
