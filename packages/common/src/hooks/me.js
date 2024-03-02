import React from "react";
import { useStore } from "../store.js";
import { selectMe, selectChannelNotificationSetting } from "../reducers/me.js";
import {
  selectStarredUsers,
  selectStarredUserIds,
  selectBlockedUserIds,
  selectIsUserStarred,
  selectIsUserBlocked,
} from "../reducers/users.js";

export const useMe = () => useStore(selectMe);

export const useChannelNotificationSetting = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelNotificationSetting(state, channelId),
      [channelId],
    ),
  );

export const useStarredUsers = () => useStore(selectStarredUsers);
export const useStarredUserIds = () => useStore(selectStarredUserIds);

export const useBlockedUserIds = () => useStore(selectBlockedUserIds);

export const useIsUserStarred = (userId) =>
  useStore(
    React.useCallback(
      (state) => (userId == null ? null : selectIsUserStarred(state, userId)),
      [userId],
    ),
  );

export const useIsUserBlocked = (userId) =>
  useStore(
    React.useCallback(
      (state) => (userId == null ? null : selectIsUserBlocked(state, userId)),
      [userId],
    ),
  );
