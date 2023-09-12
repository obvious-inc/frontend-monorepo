import React from "react";
import { useNeynarChannelCasts } from "./neynar.js";

const pendingPromisesByQueryKey = {};

// This fetcher only allows for a single request (with the same query) to be
// pending at once. Subsequent "equal" request will simply return the initial
// pending request promise.
const useChannelCastsFetcher = (channelId) => {
  const { fetchCasts } = useNeynarChannelCasts(channelId);

  return React.useCallback(
    async (query = {}) => {
      const { cursor } = query;
      const queryParams = new URLSearchParams([
        ["channel", channelId],
        ["cursor", cursor],
      ]);

      if (cursor) queryParams.set("cursor", cursor);

      const queryKey = queryParams.toString();

      let pendingPromise = pendingPromisesByQueryKey[queryKey];

      if (pendingPromise == null) {
        pendingPromise = fetchCasts(cursor);
        pendingPromisesByQueryKey[queryKey] = pendingPromise;
      }

      try {
        return await pendingPromise;
      } finally {
        delete pendingPromisesByQueryKey[queryKey];
      }
    },
    [channelId, fetchCasts]
  );
};

export default useChannelCastsFetcher;
