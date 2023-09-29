import React from "react";
import { useFetch } from "@shades/common/react";
import {
  fetchNeynarCasts,
  fetchNeynarRecentCasts,
  fetchNeynarThreadCasts,
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
    castsByChannelId: {},
    castsByThreadHash: {},
    recentCastsByFid: {},
    recentCasts: [],
    followedChannelsByFid: getInitialFollowedChannels(),
    readStatesByChannelId: getInitialReadStates(),
  }));

  React.useEffect(() => {
    localStorage.setItem(
      "ns:read-states",
      JSON.stringify(state.readStatesByChannelId)
    );
  }, [state.readStatesByChannelId]);

  React.useEffect(() => {
    localStorage.setItem(
      "ns:followed-channels",
      JSON.stringify(state.followedChannelsByFid)
    );
  }, [state.followedChannelsByFid]);

  const fetchChannelCasts = React.useCallback(async ({ channel, cursor }) => {
    return fetchNeynarCasts({ parentUrl: channel?.parentUrl, cursor }).then(
      (casts) => {
        setState((s) => {
          return {
            ...s,
            castsByChannelId: {
              ...s.castsByChannelId,
              [channel?.id]: casts,
            },
          };
        });
      }
    );
  }, []);

  const fetchFeedCasts = React.useCallback(async ({ fid, cursor }) => {
    if (fid) {
      return fetchNeynarCasts({ fid, cursor }).then((casts) => {
        setState((s) => {
          return {
            ...s,
            recentCastsByFid: {
              ...s.recentCastsByFid,
              [fid]: casts,
            },
          };
        });
      });
    } else {
      return fetchNeynarRecentCasts({ cursor }).then((casts) => {
        setState((s) => {
          return {
            ...s,
            recentCasts: casts,
          };
        });
      });
    }
  }, []);

  const fetchThreadCasts = React.useCallback(async ({ threadHash, cursor }) => {
    return fetchNeynarThreadCasts({ threadCastHash: threadHash, cursor }).then(
      (casts) => {
        setState((s) => {
          return {
            ...s,
            castsByThreadHash: {
              ...s.castsByThreadHash,
              [threadHash]: casts,
            },
          };
        });
      }
    );
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
              ...s.followedChannelsByFid[fid],
              ...channels.filter(
                (c) =>
                  !s.followedChannelsByFid[fid].some((cc) => cc.id === c.id)
              ),
            ],
          },
        };
      });

      return channels;
    });
  }, []);

  const fetchUnreadState = React.useCallback(async ({ channel }) => {
    return fetchNeynarCasts({
      parentUrl: channel?.parentUrl,
      limit: 1,
      reverse: true,
    }).then((casts) => {
      const lastCast = casts[0];
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
            },
          },
        };
      });
    });
  }, []);

  const markChannelRead = React.useCallback(async (channelId) => {
    const readAt = new Date();
    setState((s) => {
      return {
        ...s,
        readStatesByChannelId: {
          ...s.readStatesByChannelId,
          [channelId]: {
            ...s.readStatesByChannelId[channelId],
            lastReadAt: readAt,
          },
        },
      };
    });
  }, []);

  const followChannel = React.useCallback(async ({ fid, channel }) => {
    setState((s) => {
      return {
        ...s,
        followedChannelsByFid: {
          ...s.followedChannelsByFid,
          [fid]: [...s.followedChannelsByFid[fid], channel],
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
          [fid]: s.followedChannelsByFid[fid].filter(
            (c) => c.id !== channel.id
          ),
        },
      };
    });
  }, []);

  const contextValue = React.useMemo(
    () => ({
      state,
      actions: {
        fetchChannelCasts,
        fetchThreadCasts,
        fetchFeedCasts,
        fetchFollowedChannels,
        fetchUnreadState,
        markChannelRead,
        followChannel,
        unfollowChannel,
      },
    }),
    [
      state,
      fetchChannelCasts,
      fetchThreadCasts,
      fetchFeedCasts,
      fetchFollowedChannels,
      fetchUnreadState,
      markChannelRead,
      followChannel,
      unfollowChannel,
    ]
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
    [fetchChannelCasts, channel, cursor]
  );
};

export const useChannelCasts = (channelId) => {
  const {
    state: { castsByChannelId },
  } = React.useContext(ChannelCacheContext);

  return castsByChannelId[channelId];
};

export const useFeedCastsFetch = ({ fid, cursor }) => {
  const {
    actions: { fetchFeedCasts },
  } = React.useContext(ChannelCacheContext);

  useFetch(
    () =>
      fetchFeedCasts({ fid, cursor }).catch((e) => {
        throw e;
      }),
    [fetchFeedCasts, fid, cursor]
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
    [fetchThreadCasts, threadCast, cursor]
  );
};

export const useThreadCasts = (threadHash) => {
  const {
    state: { castsByThreadHash },
  } = React.useContext(ChannelCacheContext);

  return castsByThreadHash[threadHash];
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
            })
          );
        })
        .catch((e) => {
          throw e;
        }),
    [fetchFollowedChannels, fid]
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

export const useIsChannelFollowed = (channelId) => {
  const {
    state: { followedChannelsByFid },
  } = React.useContext(ChannelCacheContext);

  const { fid } = useFarcasterAccount();
  const followedChannels = followedChannelsByFid[fid];
  return followedChannels?.some((c) => c.id === channelId);
};
