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
  selectChannelHasBeenSeen,
  selectChannelMentionCount,
  selectChannelAccessLevel,
  selectIsChannelStarred,
  selectChannelHasOpenReadAccess,
  selectHasFetchedMessages,
  selectHasAllMessages,
  selectLastPageEndMessageId,
  selectTotalMentionCount,
  selectPermissions as selectChannelPermissions,
  selectChannelsWithMembers,
  selectDmChannelWithMember,
} from "../reducers/channels.js";
import { selectChannelTypingMembers } from "../reducers/channel-typing-status.js";
import {
  selectChannelMessages,
  selectSortedChannelMessageIds,
  selectMessage,
  selectHasReacted,
} from "../reducers/messages.js";

export const useChannel = (channelId, options = {}) => {
  return useStore(
    React.useCallback(
      (state) =>
        channelId == null ? null : selectChannel(state, channelId, options),
      // eslint-disable-next-line
      [channelId, ...Object.values(options)],
    ),
  );
};

// LEGACY
export const useChannelMessages = (channelId) =>
  useStore(
    React.useCallback(
      (state) =>
        channelId == null ? null : selectChannelMessages(state, channelId),
      [channelId],
    ),
  );

export const useSortedChannelMessageIds = (channelId, options = {}) =>
  useStore(
    React.useCallback(
      (state) => selectSortedChannelMessageIds(state, channelId, options),
      // eslint-disable-next-line
      [channelId, ...Object.values(options)],
    ),
  );

export const useChannelName = (channelId) =>
  useStore(
    React.useCallback(
      (state) =>
        channelId == null ? null : selectChannelName(state, channelId),
      [channelId],
    ),
  );

export const useChannelHasUnread = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelHasUnread(state, channelId),
      [channelId],
    ),
  );

export const useChannelHasBeenSeen = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelHasBeenSeen(state, channelId),
      [channelId],
    ),
  );

export const useChannelMentionCount = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelMentionCount(state, channelId),
      [channelId],
    ),
  );

export const useChannelMembers = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelMembers(state, channelId),
      [channelId],
    ),
  );

export const useChannelAccessLevel = (channelId) =>
  useStore(
    React.useCallback(
      (state) =>
        channelId == null ? null : selectChannelAccessLevel(state, channelId),
      [channelId],
    ),
  );

export const useIsChannelStarred = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectIsChannelStarred(state, channelId),
      [channelId],
    ),
  );

export const useHasAllChannelMessages = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectHasAllMessages(state, channelId),
      [channelId],
    ),
  );

export const useHasFetchedChannelMessages = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectHasFetchedMessages(state, channelId),
      [channelId],
    ),
  );

export const useChannelLastPageEndMessageId = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectLastPageEndMessageId(state, channelId),
      [channelId],
    ),
  );

export const useChannelHasOpenReadAccess = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelHasOpenReadAccess(state, channelId),
      [channelId],
    ),
  );

export const useChannelPermissions = (channelId) =>
  useStore(
    React.useCallback(
      (state) =>
        channelId == null ? {} : selectChannelPermissions(state, channelId),
      [channelId],
    ),
  );

export const useChannelTypingMembers = (channelId) =>
  useStore(
    React.useCallback(
      (state) => selectChannelTypingMembers(state, channelId),
      [channelId],
    ),
  );

export const useMemberChannels = (options = {}) =>
  useStore(
    React.useCallback(
      (s) => selectMemberChannels(s, options),
      // eslint-disable-next-line
      Object.values(options),
    ),
  );

export const useAllChannels = (options = {}) =>
  useStore(
    React.useCallback(
      (state) => selectAllChannels(state, options),
      // eslint-disable-next-line
      Object.values(options),
    ),
  );

export const useStarredChannels = (options = {}) =>
  useStore(
    React.useCallback(
      (state) => selectStarredChannels(state, options),
      // eslint-disable-next-line
      Object.values(options),
    ),
  );

export const usePublicChannels = (options = {}) =>
  useStore(
    React.useCallback(
      (state) => selectPublicChannels(state, options),
      // eslint-disable-next-line
      Object.values(options),
    ),
  );

export const useChannelsWithMembers = (memberWalletAddresses, options = {}) =>
  useStore(
    React.useCallback(
      (state) =>
        selectChannelsWithMembers(state, memberWalletAddresses, options),
      // eslint-disable-next-line
      [memberWalletAddresses, ...Object.values(options)],
    ),
  );

export const useTotalMentionCount = () => useStore(selectTotalMentionCount);

export const useMessage = (messageId, options = {}) =>
  useStore(
    React.useCallback(
      (state) =>
        messageId == null ? null : selectMessage(state, messageId, options),
      // eslint-disable-next-line
      [messageId, ...Object.values(options)],
    ),
  );

export const useHasReactedWithEmoji = (messageId, emoji) =>
  useStore(
    React.useCallback(
      (state) => selectHasReacted(state, messageId, emoji),
      [messageId, emoji],
    ),
  );

export const useDmChannelWithMember = (walletAddress) =>
  useStore(
    React.useCallback(
      (state) =>
        walletAddress == null
          ? null
          : selectDmChannelWithMember(state, walletAddress),
      [walletAddress],
    ),
  );
