import React from "react";
import { useStore } from "../store.js";
import {
  selectAllChannels,
  selectMemberChannels,
  selectStarredChannels,
  selectPublicChannels,
  selectChannel,
  selectChannelMembers,
  selectChannelName,
  selectChannelHasUnread,
  selectChannelMentionCount,
  selectChannelAccessLevel,
  selectIsChannelStarred,
  selectChannelHasOpenReadAccess,
  selectHasFetchedMessages,
  selectHasAllMessages,
  selectTotalMentionCount,
  selectPermissions as selectChannelPermissions,
} from "../reducers/channels.js";
import { selectChannelTypingMembers } from "../reducers/channel-typing-status.js";
import { selectChannelMessages, selectMessage } from "../reducers/messages.js";

export const useChannel = (channelId, { members = false } = {}) => {
  return useStore(
    React.useCallback(
      (state) =>
        channelId == null ? null : selectChannel(state, channelId, { members }),
      [channelId, members]
    )
  );
};

export const useChannelMessages = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelMessages(state, channelId),
      [channelId]
    )
  );

export const useChannelName = (channelId) =>
  useStore(
    React.useCallback(
      (state) =>
        channelId == null ? null : selectChannelName(state, channelId),
      [channelId]
    )
  );

export const useChannelHasUnread = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelHasUnread(state, channelId),
      [channelId]
    )
  );

export const useChannelMentionCount = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelMentionCount(state, channelId),
      [channelId]
    )
  );

export const useChannelMembers = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelMembers(state, channelId),
      [channelId]
    )
  );

export const useChannelAccessLevel = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelAccessLevel(state, channelId),
      [channelId]
    )
  );

export const useIsChannelStarred = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectIsChannelStarred(state, channelId),
      [channelId]
    )
  );

export const useHasAllChannelMessages = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectHasAllMessages(state, channelId),
      [channelId]
    )
  );

export const useHasFetchedChannelMessages = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectHasFetchedMessages(state, channelId),
      [channelId]
    )
  );

export const useChannelHasOpenReadAccess = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelHasOpenReadAccess(state, channelId),
      [channelId]
    )
  );

export const useChannelPermissions = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelPermissions(state, channelId),
      [channelId]
    )
  );

export const useChannelTypingMembers = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelTypingMembers(state, channelId),
      [channelId]
    )
  );

export const useMemberChannels = () => useStore(selectMemberChannels);

export const useAllChannels = ({ members = false } = {}) =>
  useStore(
    React.useCallback(
      (state) => selectAllChannels(state, { members }),
      [members]
    )
  );

export const useStarredChannels = () => useStore(selectStarredChannels);

export const usePublicChannels = () => useStore(selectPublicChannels);

export const useTotalMentionCount = () => useStore(selectTotalMentionCount);

export const useMessage = (messageId) =>
  useStore(
    React.useCallback(
      (state) => (messageId == null ? null : selectMessage(state, messageId)),
      [messageId]
    )
  );
