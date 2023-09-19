import React from "react";
import { useFetch } from "@shades/common/react";
import { fetchNeynarCasts } from "./neynar";

export const ChannelCacheContext = React.createContext();

export const ChannelCacheContextProvider = ({ children }) => {
  const [state, setState] = React.useState({
    castsByChannelId: {},
    castHashesByChannelId: {},
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
            castHashesByChannelId: {
              ...s.castHashesByChannelId,
              [channel?.id]: casts.map((cast) => cast.hash),
            },
          };
        });
      }
    );
  }, []);

  const contextValue = React.useMemo(
    () => ({ state, actions: { fetchChannelCasts } }),
    [state, fetchChannelCasts]
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

export const useReversedChannelCasts = (channelId) => {
  const casts = useChannelCasts(channelId);

  return React.useMemo(() => {
    if (!casts) return [];
    return casts.slice().reverse();
  }, [casts]);
};
