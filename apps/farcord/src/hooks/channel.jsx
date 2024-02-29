import React from "react";
import { useFetch } from "@shades/common/react";
import {
  extractUsersFromNeynarCast,
  fetchNeynarCast,
  fetchNeynarFeedCasts,
  fetchNeynarRecentCasts,
  fetchNeynarThreadCasts,
  fetchUserByFid as fetchNeynarUserByFid,
} from "./neynar";
import { fetchWarpcastFollowedChannels } from "./warpcast";
import { ChainDataCacheContext } from "./farcord";
import useFarcasterAccount from "../components/farcaster-account";

const getInitialReadStates = () => {
  return JSON.parse(localStorage.getItem("ns:read-states")) ?? {};
};

const getInitialFollowedChannels = () => {
  return JSON.parse(localStorage.getItem("ns:followed-channels")) ?? {};
};

export const ChannelCacheContext = React.createContext();

export const ChannelCacheContextProvider = ({ children }) => {
  const [state, setState] = React.useState(() => ({
    castsByHash: {},
    castsByChannelId: {},
    castsByThreadHash: {},
    recentCastsByFid: {},
    recentCasts: [],
    followedChannelsByFid: getInitialFollowedChannels(),
    readStatesByChannelId: getInitialReadStates(),
    usersByFid: {},
  }));

  React.useEffect(() => {
    localStorage.setItem(
      "ns:read-states",
      JSON.stringify(state.readStatesByChannelId),
    );
  }, [state.readStatesByChannelId]);

  React.useEffect(() => {
    localStorage.setItem(
      "ns:followed-channels",
      JSON.stringify(state.followedChannelsByFid),
    );
  }, [state.followedChannelsByFid]);

  const fetchChannelCasts = React.useCallback(async ({ channel, cursor }) => {
    return fetchNeynarFeedCasts({ parentUrl: channel?.parentUrl, cursor }).then(
      (casts) => {
        const castsUsers = casts.reduce((acc, cast) => {
          acc.push(...extractUsersFromNeynarCast(cast));
          return acc;
        }, []);

        setState((s) => {
          return {
            ...s,
            castsByChannelId: {
              ...s.castsByChannelId,
              [channel?.id]: casts,
            },
            castsByHash: {
              ...s.castsByHash,
              ...casts.reduce((acc, cast) => {
                acc[cast.hash] = cast;
                return acc;
              }, {}),
            },
            usersByFid: {
              ...s.usersByFid,
              ...castsUsers.reduce((acc, user) => {
                acc[user.fid] = user;
                return acc;
              }, {}),
            },
          };
        });
      },
    );
  }, []);

  const fetchFeedCasts = React.useCallback(async ({ fid, cursor, isFeed }) => {
    if (isFeed && fid) {
      return fetchNeynarFeedCasts({ fid, cursor }).then((casts) => {
        const castsUsers = casts.reduce((acc, cast) => {
          acc.push(...extractUsersFromNeynarCast(cast));
          return acc;
        }, []);

        setState((s) => {
          return {
            ...s,
            recentCastsByFid: {
              ...s.recentCastsByFid,
              [fid]: casts,
            },
            castsByHash: {
              ...s.castsByHash,
              ...casts.reduce((acc, cast) => {
                acc[cast.hash] = cast;
                return acc;
              }, {}),
            },
            usersByFid: {
              ...s.usersByFid,
              ...castsUsers.reduce((acc, user) => {
                acc[user.fid] = user;
                return acc;
              }, {}),
            },
          };
        });
      });
    } else {
      return fetchNeynarRecentCasts({ cursor }).then((casts) => {
        const castsUsers = casts.reduce((acc, cast) => {
          acc.push(...extractUsersFromNeynarCast(cast));
          return acc;
        }, []);

        setState((s) => {
          return {
            ...s,
            recentCasts: casts,
            castsByHash: {
              ...s.castsByHash,
              ...casts.reduce((acc, cast) => {
                acc[cast.hash] = cast;
                return acc;
              }, {}),
            },
            usersByFid: {
              ...s.usersByFid,
              ...castsUsers.reduce((acc, user) => {
                acc[user.fid] = user;
                return acc;
              }, {}),
            },
          };
        });
      });
    }
  }, []);

  const fetchThreadCasts = React.useCallback(async ({ threadHash, cursor }) => {
    return fetchNeynarThreadCasts({ threadCastHash: threadHash, cursor }).then(
      (casts) => {
        // ignore casts before specific cast requested from thread
        const castHashes = casts.map((c) => c.hash);
        const threadIndex = castHashes.indexOf(threadHash);
        const threadCasts = casts.slice(threadIndex + 1);
        const castsUsers = threadCasts.reduce((acc, cast) => {
          acc.push(...extractUsersFromNeynarCast(cast));
          return acc;
        }, []);

        setState((s) => {
          return {
            ...s,
            castsByThreadHash: {
              ...s.castsByThreadHash,
              [threadHash]: threadCasts,
            },
            castsByHash: {
              ...s.castsByHash,
              ...threadCasts.reduce((acc, cast) => {
                acc[cast.hash] = cast;
                return acc;
              }, {}),
            },
            usersByFid: {
              ...s.usersByFid,
              ...castsUsers.reduce((acc, user) => {
                acc[user.fid] = user;
                return acc;
              }, {}),
            },
          };
        });
      },
    );
  }, []);

  const fetchCast = React.useCallback(async ({ castHash }) => {
    return fetchNeynarCast(castHash).then((cast) => {
      const castUsers = extractUsersFromNeynarCast(cast).filter(
        (u) => u.fid != null,
      );

      setState((s) => {
        return {
          ...s,
          castsByHash: {
            ...s.castsByHash,
            [castHash]: cast,
          },
          usersByFid: {
            ...s.usersByFid,
            ...castUsers.reduce((acc, user) => {
              acc[user.fid] = user;
              return acc;
            }, {}),
          },
        };
      });
    });
  }, []);

  const fetchFollowedChannels = React.useCallback(async ({ fid }) => {
    if (!fid) return [];
    return fetchWarpcastFollowedChannels({ fid }).then((channels) => {
      setState((s) => {
        return {
          ...s,
          followedChannelsByFid: {
            ...s.followedChannelsByFid,
            [fid]: [
              ...(s.followedChannelsByFid[fid] ?? []),
              ...channels.filter(
                (c) =>
                  !s.followedChannelsByFid[fid]?.some((cc) => cc.id === c.id),
              ),
            ],
          },
        };
      });

      return channels;
    });
  }, []);

  const fetchUnreadState = React.useCallback(async ({ channel }) => {
    if (!channel) return;

    return fetchNeynarFeedCasts({
      parentUrl: channel?.parentUrl,
      limit: 10,
      reverse: true,
    }).then((casts) => {
      if (casts?.length == 0) return;

      const lastCast = casts.slice(-1)[0];
      const lastCastAt = lastCast?.timestamp;

      setState((s) => {
        return {
          ...s,
          readStatesByChannelId: {
            ...s.readStatesByChannelId,
            [channel?.id]: {
              ...s.readStatesByChannelId[channel?.id],
              lastCastAt,
              lastCastHash: lastCast?.hash,
              lastCastHashes: casts.map((c) => c.hash),
            },
          },
        };
      });
    });
  }, []);

  const fetchUserByFid = React.useCallback(async ({ fid }) => {
    if (!fid) return;
    return fetchNeynarUserByFid(fid).then((user) => {
      setState((s) => {
        return {
          ...s,
          usersByFid: {
            ...s.usersByFid,
            [fid]: user,
          },
        };
      });
      return user;
    });
  }, []);

  const markChannelRead = React.useCallback(
    async ({ channelId, lastCastHash }) => {
      const readAt = new Date();
      setState((s) => {
        return {
          ...s,
          readStatesByChannelId: {
            ...s.readStatesByChannelId,
            [channelId]: {
              ...s.readStatesByChannelId[channelId],
              lastReadAt: readAt,
              lastReadHash: lastCastHash,
            },
          },
        };
      });
    },
    [],
  );

  const followChannel = React.useCallback(async ({ fid, channel }) => {
    setState((s) => {
      return {
        ...s,
        followedChannelsByFid: {
          ...s.followedChannelsByFid,
          [fid]: [...(s.followedChannelsByFid[fid] ?? []), channel],
        },
      };
    });
  }, []);

  const unfollowChannel = React.useCallback(async ({ fid, channel }) => {
    setState((s) => {
      return {
        ...s,
        followedChannelsByFid: {
          ...s.followedChannelsByFid,
          [fid]: s.followedChannelsByFid[fid]?.filter(
            (c) => c.id !== channel.id,
          ),
        },
      };
    });
  }, []);

  const contextValue = React.useMemo(
    () => ({
      state,
      actions: {
        fetchCast,
        fetchChannelCasts,
        fetchThreadCasts,
        fetchFeedCasts,
        fetchFollowedChannels,
        fetchUnreadState,
        markChannelRead,
        followChannel,
        unfollowChannel,
        fetchUserByFid,
      },
    }),
    [
      state,
      fetchCast,
      fetchChannelCasts,
      fetchThreadCasts,
      fetchFeedCasts,
      fetchFollowedChannels,
      fetchUnreadState,
      markChannelRead,
      followChannel,
      unfollowChannel,
      fetchUserByFid,
    ],
  );

  return (
    <ChannelCacheContext.Provider value={contextValue}>
      {children}
    </ChannelCacheContext.Provider>
  );
};

export const useChannelCastsFetch = ({ channel, cursor }) => {
  const {
    actions: { fetchChannelCasts },
  } = React.useContext(ChannelCacheContext);

  useFetch(
    () =>
      fetchChannelCasts({ channel, cursor }).catch((e) => {
        throw e;
      }),
    [fetchChannelCasts, channel, cursor],
  );
};

export const useChannelCasts = (channelId) => {
  const {
    state: { castsByChannelId },
  } = React.useContext(ChannelCacheContext);

  return castsByChannelId[channelId];
};

export const useFeedCastsFetch = ({ fid, cursor, isFeed = false }) => {
  const {
    actions: { fetchFeedCasts },
  } = React.useContext(ChannelCacheContext);

  useFetch(
    () =>
      fetchFeedCasts({ fid, cursor, isFeed }).catch((e) => {
        throw e;
      }),
    [fetchFeedCasts, fid, cursor, isFeed],
  );
};

export const useFeedCasts = (fid) => {
  const {
    state: { recentCastsByFid, recentCasts },
  } = React.useContext(ChannelCacheContext);

  if (fid) return recentCastsByFid[fid];
  return recentCasts;
};

export const useReversedChannelCasts = (channelId) => {
  const casts = useChannelCasts(channelId);

  return React.useMemo(() => {
    if (!casts) return [];
    return casts.slice().reverse();
  }, [casts]);
};

export const useThreadCastsFetch = ({ threadCast, cursor }) => {
  const {
    actions: { fetchThreadCasts },
  } = React.useContext(ChannelCacheContext);

  useFetch(
    () =>
      fetchThreadCasts({ threadHash: threadCast, cursor }).catch((e) => {
        throw e;
      }),
    [fetchThreadCasts, threadCast, cursor],
  );
};

export const useThreadCasts = (threadHash) => {
  const {
    state: { castsByThreadHash },
  } = React.useContext(ChannelCacheContext);

  return castsByThreadHash[threadHash];
};

export const useCastFetch = ({ castHash }) => {
  const {
    actions: { fetchCast },
  } = React.useContext(ChannelCacheContext);

  useFetch(
    () =>
      fetchCast({ castHash }).catch((e) => {
        throw e;
      }),
    [fetchCast, castHash],
  );
};

export const useCast = (castHash) => {
  const {
    state: { castsByHash },
    actions: { fetchCast },
  } = React.useContext(ChannelCacheContext);

  const cast = castsByHash[castHash];

  React.useEffect(() => {
    if (!cast && castHash) {
      fetchCast({ castHash });
    }
  }, [cast, fetchCast, castHash]);

  return cast;
};

export function useChannelCacheContext() {
  const context = React.useContext(ChannelCacheContext);
  return context;
}

const useFollowedChannelsFetch = ({ fid }) => {
  const {
    actions: { fetchFollowedChannels, fetchUnreadState },
  } = React.useContext(ChannelCacheContext);

  const {
    state: { channelsById },
  } = React.useContext(ChainDataCacheContext);

  useFetch(
    () =>
      fetchFollowedChannels({ fid })
        .then((channels) => {
          if (!channels) return;
          return Promise.all(
            channels.map((channel) => {
              const channelId = channel?.id;
              const cachedChannel = channelsById[channelId];
              return fetchUnreadState({ channel: cachedChannel });
            }),
          );
        })
        .catch((e) => {
          throw e;
        }),
    [fetchFollowedChannels, fid],
  );
};

export const useFollowedChannels = (fid) => {
  const {
    state: { followedChannelsByFid },
  } = React.useContext(ChannelCacheContext);

  useFollowedChannelsFetch({ fid });
  return followedChannelsByFid[fid];
};

export const useChannelHasUnread = (channelId) => {
  const {
    state: { readStatesByChannelId },
  } = React.useContext(ChannelCacheContext);
  if (!channelId) return;

  const channelState = readStatesByChannelId[channelId];
  if (channelState == null) return false;

  const hasCasts = channelState.lastCastAt != null;
  const hasSeen = channelState.lastReadAt != null;

  if (!hasCasts) return !hasSeen;
  if (!hasSeen) return true;

  const lastReadTimestamp = new Date(channelState.lastReadAt).getTime();
  const lastCastTimestamp = new Date(channelState.lastCastAt).getTime();

  return lastReadTimestamp < lastCastTimestamp;
};

export const useChannelUnreadCount = (channelId) => {
  const {
    state: { readStatesByChannelId },
  } = React.useContext(ChannelCacheContext);
  if (!channelId) return;

  const channelState = readStatesByChannelId[channelId];
  if (channelState == null) return;
  if (!channelState.lastCastAt) return;

  const lastReadTimestamp = new Date(channelState.lastReadAt).getTime();
  const lastCastTimestamp = new Date(channelState.lastCastAt).getTime();
  if (lastReadTimestamp > lastCastTimestamp) return 0;

  const lastReadHash = channelState.lastReadHash;
  if (!lastReadHash) return 0;

  const lastHashes = channelState.lastCastHashes;

  if (!lastHashes || lastHashes.length == 0) return 0;

  try {
    const position = lastHashes.indexOf(lastReadHash);
    const unread = channelState.lastCastHashes.length - 1 - position;
    return unread;
  } catch (e) {
    console.error("problem calculating unread for channel", channelId, e);
    return 0;
  }
};

export const useChannelLastReadCast = (channelId) => {
  const {
    state: { readStatesByChannelId },
  } = React.useContext(ChannelCacheContext);
  if (!channelId) return;

  const channelState = readStatesByChannelId[channelId];
  if (channelState == null) return null;

  return channelState.lastReadHash;
};

export const useIsChannelFollowed = (channelId) => {
  const {
    state: { followedChannelsByFid },
  } = React.useContext(ChannelCacheContext);

  const { fid } = useFarcasterAccount();
  const followedChannels = followedChannelsByFid[fid];
  return followedChannels?.some((c) => c.id === channelId);
};

export const useUnreadStatesFetch = (fid) => {
  const {
    state: { followedChannelsByFid },
    actions: { fetchUnreadState },
  } = React.useContext(ChannelCacheContext);

  React.useEffect(() => {
    if (!fid) return;
    const followedChannels = followedChannelsByFid[fid];
    if (!followedChannels) return;

    followedChannels.forEach((channel) => {
      fetchUnreadState({ channel });
    });
  }, [fid, followedChannelsByFid, fetchUnreadState]);
};

export const useUserByFid = (fid) => {
  const {
    state: { usersByFid },
    actions: { fetchUserByFid },
  } = React.useContext(ChannelCacheContext);

  const user = usersByFid[Number(fid)];

  React.useEffect(() => {
    if (!user) {
      fetchUserByFid({ fid: Number(fid) });
    }
  }, [user, fetchUserByFid, fid]);

  return user;
};
