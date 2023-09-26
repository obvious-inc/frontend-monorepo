import React from "react";
import { useFetch } from "@shades/common/react";
import {
  fetchNeynarCasts,
  fetchNeynarRecentCasts,
  fetchNeynarThreadCasts,
} from "./neynar";

export const ChannelCacheContext = React.createContext();

export const ChannelCacheContextProvider = ({ children }) => {
  const [state, setState] = React.useState({
    castsByChannelId: {},
    castsByThreadHash: {},
    recentCastsByFid: {},
    recentCasts: [],
  });

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

  const contextValue = React.useMemo(
    () => ({
      state,
      actions: {
        fetchChannelCasts,
        fetchThreadCasts,
        fetchFeedCasts,
      },
    }),
    [state, fetchChannelCasts, fetchThreadCasts, fetchFeedCasts]
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
