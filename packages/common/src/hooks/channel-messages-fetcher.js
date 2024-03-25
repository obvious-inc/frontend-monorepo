import React from "react";
import { useActions } from "../store.js";

const pendingPromisesByQueryKey = {};

// This fetcher only allows for a single request (with the same query) to be
// pending at once. Subsequent "equal" request will simply return the initial
// pending request promise.
const useChannelMessagesFetcher = (channelId) => {
  const { fetchMessages } = useActions();

  return React.useCallback(
    async (query = {}) => {
      const { limit, beforeMessageId, afterMessageId } = query;
      const queryKey = new URLSearchParams([
        ["channel", channelId],
        ["limit", limit],
        ["before-message-id", beforeMessageId],
        ["after-message-id", afterMessageId],
      ]).toString();

      let pendingPromise = pendingPromisesByQueryKey[queryKey];

      if (pendingPromise == null) {
        pendingPromise = fetchMessages(channelId, query);
        pendingPromisesByQueryKey[queryKey] = pendingPromise;
      }

      try {
        return await pendingPromise;
      } finally {
        delete pendingPromisesByQueryKey[queryKey];
      }
    },
    [channelId, fetchMessages],
  );
};

export default useChannelMessagesFetcher;
