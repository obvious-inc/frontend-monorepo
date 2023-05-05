import React from "react";
import useChannelMessagesFetcher from "./channel-messages-fetcher.js";
import useReverseScrollPositionMaintainer from "./reverse-scroll-position-maintainer.js";

const useScrollAwareChannelMessagesFetcher = (
  channelId,
  { scrollContainerRef }
) => {
  const baseFetcher = useChannelMessagesFetcher();

  // This needs to be called before every state change that impacts the scroll
  // container height
  const maintainScrollPositionDuringTheNextDomMutation =
    useReverseScrollPositionMaintainer(scrollContainerRef);
  const fetcher = React.useCallback(
    (query) => {
      if (query.beforeMessageId) {
        // Maintain scroll position when we render the loading placeholder
        maintainScrollPositionDuringTheNextDomMutation();
      }

      return baseFetcher(channelId, {
        ...query,
        onSuccess: () => {
          // Maintain scroll position when new messages arrive
          maintainScrollPositionDuringTheNextDomMutation();
        },
      }).finally(() => {
        if (query.beforeMessageId) {
          // Maintain scroll position when we remove the loading placeholder
          maintainScrollPositionDuringTheNextDomMutation();
        }
      });
    },
    [baseFetcher, channelId, maintainScrollPositionDuringTheNextDomMutation]
  );

  return fetcher;
};

export default useScrollAwareChannelMessagesFetcher;
