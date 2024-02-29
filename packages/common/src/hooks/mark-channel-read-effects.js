import React from "react";
import useWindowFocusOrDocumentVisibleListener from "../react/hooks/window-focus-or-document-visible-listener.js";
import useWindowOnlineListener from "../react/hooks/window-online-listener.js";
import { useActions } from "../store.js";
import {
  useChannelHasUnread,
  useHasFetchedChannelMessages,
} from "./channel.js";

const useMarkChannelReadEffects = (channelId, { didScrollToBottomRef }) => {
  const { markChannelRead } = useActions();

  const channelHasUnread = useChannelHasUnread(channelId);
  const hasFetchedChannelMessagesAtLeastOnce =
    useHasFetchedChannelMessages(channelId);

  // Mark channel as read when new messages arrive and when switching channels
  React.useEffect(() => {
    if (
      // Only mark as read when the page has focus
      !document.hasFocus() ||
      // Wait until the initial message batch is fetched
      !hasFetchedChannelMessagesAtLeastOnce ||
      // Only mark as read when scrolled to the bottom
      !didScrollToBottomRef.current ||
      // Don’t bother if the channel is already marked as read
      !channelHasUnread
    )
      return;

    markChannelRead(channelId);
  }, [
    channelId,
    channelHasUnread,
    hasFetchedChannelMessagesAtLeastOnce,
    didScrollToBottomRef,
    markChannelRead,
  ]);

  useWindowFocusOrDocumentVisibleListener(() => {
    if (channelHasUnread && didScrollToBottomRef.current)
      markChannelRead(channelId);
  });

  useWindowOnlineListener(
    () => {
      if (channelHasUnread && didScrollToBottomRef.current)
        markChannelRead(channelId);
    },
    { requireFocus: true },
  );
};

export default useMarkChannelReadEffects;
