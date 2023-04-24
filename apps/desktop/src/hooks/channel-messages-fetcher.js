import { useActions } from "@shades/common/app";
import { useLatestCallback } from "@shades/common/react";

const pendingPromisesByQueryKey = {};

// This fetcher only allows for a single request (with the same query) to be
// pending at once. Subsequent "equal" request will simply return the initial
// pending request promise.
const useChannelMessagesFetcher = () => {
  const actions = useActions();

  const fetchMessages = useLatestCallback(
    async (channelId, { limit, beforeMessageId, afterMessageId } = {}) => {
      const queryKey = new URLSearchParams([
        ["channel", channelId],
        ["limit", limit],
        ["before-message-id", beforeMessageId],
        ["after-message-id", afterMessageId],
      ]).toString();

      let pendingPromise = pendingPromisesByQueryKey[queryKey];

      if (pendingPromise == null) {
        pendingPromise = actions.fetchMessages(channelId, {
          limit,
          beforeMessageId,
          afterMessageId,
        });
        pendingPromisesByQueryKey[queryKey] = pendingPromise;
      }

      try {
        return await pendingPromise;
      } finally {
        delete pendingPromisesByQueryKey[queryKey];
      }
    }
  );

  return fetchMessages;
};

export default useChannelMessagesFetcher;
