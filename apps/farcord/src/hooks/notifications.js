import React from "react";
import { useFetch } from "@shades/common/react";
import { fetchMentionAndReplies, fetchReactionsAndRecasts } from "./neynar";
import { array as arrayUtils } from "@shades/common/utils";
export const NotificationsContext = React.createContext();

const getInitialNotificationsReadState = () => {
  return JSON.parse(localStorage.getItem("ns:notif-read-states")) ?? {};
};

export const NotificationsContextProvider = ({ children }) => {
  const [state, setState] = React.useState(() => ({
    mentionsByFid: {},
    repliesByFid: {},
    recastsByFid: {},
    likesByFid: {},
    lastSeenByFid: getInitialNotificationsReadState(),
  }));

  React.useEffect(() => {
    localStorage.setItem(
      "ns:notif-read-states",
      JSON.stringify(state.lastSeenByFid)
    );
  }, [state.lastSeenByFid]);

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

  const markNotificationsRead = React.useCallback(async ({ fid }) => {
    const seenAt = new Date();
    setState((s) => {
      return {
        ...s,
        lastSeenByFid: {
          ...s.lastSeenByFid,
          [fid]: seenAt,
        },
      };
    });
  }, []);

  const contextValue = React.useMemo(
    () => ({
      state,
      actions: {
        fetchNotifications,
        markNotificationsRead,
      },
    }),
    [state, fetchNotifications, markNotificationsRead]
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
    state: {
      lastSeenByFid,
      mentionsByFid,
      repliesByFid,
      recastsByFid,
      likesByFid,
    },
  } = React.useContext(NotificationsContext);
  useNotificationsByFidOrFetch(fid);

  const allFidNotifs = React.useMemo(() => {
    return [
      ...(mentionsByFid[fid] ?? []),
      ...(repliesByFid[fid] ?? []),
      ...(recastsByFid[fid] ?? []),
      ...(likesByFid[fid] ?? []),
    ];
  }, [mentionsByFid, repliesByFid, recastsByFid, likesByFid, fid]);

  const unseenNotifs = React.useMemo(() => {
    const lastSeen = lastSeenByFid[fid];
    return allFidNotifs.filter((n) => {
      return (n.latestReactionTimestamp ?? n.timestamp) > lastSeen;
    });
  }, [allFidNotifs, fid, lastSeenByFid]);

  const hasUnseenMentionsOrReplies = React.useMemo(() => {
    return unseenNotifs.some(
      (n) => n.type === "cast-mention" || n.type === "cast-reply"
    );
  }, [unseenNotifs]);

  if (!lastSeenByFid[fid]) {
    return {
      count: -1,
      hasImportant: false,
    };
  }

  return {
    count: unseenNotifs?.length || 0,
    hasImportant: hasUnseenMentionsOrReplies || false,
  };
};

export const useNotificationsByFid = (fid) => {
  const {
    state: { mentionsByFid, repliesByFid, recastsByFid, likesByFid },
  } = React.useContext(NotificationsContext);

  return {
    mentions: mentionsByFid[fid] ?? [],
    replies: repliesByFid[fid] ?? [],
    recasts: recastsByFid[fid] ?? [],
    likes: likesByFid[fid] ?? [],
  };
};

export const useNotificationsByFidOrFetch = (fid) => {
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
  const { mentions, replies, recasts, likes } =
    useNotificationsByFidOrFetch(fid);

  const notifications = React.useMemo(() => {
    return [...mentions, ...replies, ...recasts, ...likes];
  }, [mentions, replies, recasts, likes]);

  return arrayUtils.sortBy(
    { value: (n) => n.latestReactionTimestamp ?? n.timestamp, order: "desc" },
    notifications
  );
};

export function useNotificationsContext() {
  return React.useContext(NotificationsContext);
}

export const useNotificationLastSeenAt = (fid) => {
  const {
    state: { lastSeenByFid },
  } = React.useContext(NotificationsContext);

  return lastSeenByFid[fid];
};
