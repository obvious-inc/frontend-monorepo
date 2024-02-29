import React from "react";
import { useStore } from "../store.js";
import {
  selectSortedMessageReplies,
  selectStringifiedMessageContent,
} from "../reducers/messages.js";

export const useSortedMessageReplies = (messageId) =>
  useStore(
    React.useCallback(
      (state) => selectSortedMessageReplies(state, messageId),
      [messageId],
    ),
  );

export const useStringifiedMessageContent = (messageId) =>
  useStore(
    React.useCallback(
      (state) => selectStringifiedMessageContent(state, messageId),
      [messageId],
    ),
  );
