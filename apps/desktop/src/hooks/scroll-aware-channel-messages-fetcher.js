import React from "react";
import {
  useBeforeActionListener,
} from "@shades/common/app";
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

  const [pendingMessagesBeforeCount, setPendingMessagesBeforeCount] =
    React.useState(0);

  useBeforeActionListener((action) => {
    // Maintain scroll position when new messages arrive
    if (
      action.type === "fetch-messages:request-successful" &&
      action.channelId === channelId
    )
      maintainScrollPositionDuringTheNextDomMutation();
  });

  const fetcher = React.useCallback(
    (query) => {
      if (query.beforeMessageId) {
        // Maintain scroll position when we render the loading placeholder
        maintainScrollPositionDuringTheNextDomMutation();
        setPendingMessagesBeforeCount(query.limit);
      }

      return baseFetcher(channelId, query).finally(() => {
        if (query.beforeMessageId) {
          // Maintain scroll position when we remove the loading placeholder
          maintainScrollPositionDuringTheNextDomMutation();
          setPendingMessagesBeforeCount(0);
        }
      });
    },
    [baseFetcher, channelId, maintainScrollPositionDuringTheNextDomMutation]
  );

  return { fetcher, pendingMessagesBeforeCount };
};

export default useScrollAwareChannelMessagesFetcher
