import React from "react";
import { useStore } from "../store.js";
import { selectSortedMessageReplies } from "../reducers/messages.js";

export const useSortedMessageReplies = (messageId) =>
  useStore(
    React.useCallback(
      (state) => selectSortedMessageReplies(state, messageId),
      [messageId]
    )
  );
