import React from "react";
import { useFetch } from "@shades/common/react";
import { fetchNotifications as fetchAllNotifications } from "./neynar";
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
    followsByFid: {},
    lastSeenByFid: getInitialNotificationsReadState(),
  }));

  React.useEffect(() => {
    localStorage.setItem(
      "ns:notif-read-states",
      JSON.stringify(state.lastSeenByFid)
    );
  }, [state.lastSeenByFid]);

  const fetchNotifications = React.useCallback(async ({ fid }) => {
    if (!fid) return;

    fetchAllNotifications({ fid }).then((notifications) => {
      if (!notifications) return;

      const notificationsByType = arrayUtils.groupBy(
        (n) => n.type,
        notifications
      );

      setState((s) => {
        return {
          ...s,
          mentionsByFid: {
            ...s.mentionsByFid,
            [fid]: notificationsByType?.["mention"],
          },
          repliesByFid: {
            ...s.repliesByFid,
            [fid]: notificationsByType?.["reply"],
          },
          likesByFid: {
            ...s.likesByFid,
            [fid]: notificationsByType?.["likes"],
          },
          recastsByFid: {
            ...s.recastsByFid,
            [fid]: notificationsByType?.["recasts"],
          },
          followsByFid: {
            ...s.followsByFid,
            [fid]: notificationsByType?.["follows"],
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
      followsByFid,
    },
  } = React.useContext(NotificationsContext);
  useNotificationsByFidOrFetch(fid);

  const allFidNotifs = React.useMemo(() => {
    return [
      ...(mentionsByFid[fid] ?? []),
      ...(repliesByFid[fid] ?? []),
      ...(recastsByFid[fid] ?? []),
      ...(likesByFid[fid] ?? []),
      ...(followsByFid[fid] ?? []),
    ];
  }, [
    mentionsByFid,
    repliesByFid,
    recastsByFid,
    likesByFid,
    followsByFid,
    fid,
  ]);

  const unseenNotifs = React.useMemo(() => {
    const lastSeen = lastSeenByFid[fid];
    return allFidNotifs.filter((n) => {
      return (n.mostRecentTimestamp ?? n.timestamp) > lastSeen;
    });
  }, [allFidNotifs, fid, lastSeenByFid]);

  const hasUnseenMentionsOrReplies = React.useMemo(() => {
    return unseenNotifs.some((n) => n.type === "mention" || n.type === "reply");
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
    state: {
      mentionsByFid,
      repliesByFid,
      recastsByFid,
      likesByFid,
      followsByFid,
    },
  } = React.useContext(NotificationsContext);

  return {
    mentions: mentionsByFid[fid] ?? [],
    replies: repliesByFid[fid] ?? [],
    recasts: recastsByFid[fid] ?? [],
    likes: likesByFid[fid] ?? [],
    follows: followsByFid[fid] ?? [],
  };
};

export const useNotificationsByFidOrFetch = (fid) => {
  const {
    state: {
      mentionsByFid,
      repliesByFid,
      recastsByFid,
      likesByFid,
      followsByFid,
    },
  } = React.useContext(NotificationsContext);

  useNotificationsFetch({ fid });
  return {
    mentions: mentionsByFid[fid] ?? [],
    replies: repliesByFid[fid] ?? [],
    recasts: recastsByFid[fid] ?? [],
    likes: likesByFid[fid] ?? [],
    follows: followsByFid[fid] ?? [],
  };
};

export const useSortedByDateNotificationsByFid = (fid) => {
  const { mentions, replies, recasts, likes, follows } =
    useNotificationsByFidOrFetch(fid);

  const notifications = React.useMemo(() => {
    return [...mentions, ...replies, ...recasts, ...likes, ...follows];
  }, [mentions, replies, recasts, likes, follows]);

  return arrayUtils.sortBy(
    { value: (n) => n.mostRecentTimestamp ?? n.timestamp, order: "desc" },
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
