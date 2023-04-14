import { createSelector } from "reselect";
import combineReducers from "../utils/combine-reducers";
import { indexBy, groupBy, unique, sort } from "../utils/array";
import { omitKey, mapValues } from "../utils/object";
import { arrayShallowEquals } from "../utils/reselect";
import { selectUser } from "./users";
import { selectApp } from "./apps";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "fetch-messages:request-successful":
      return { ...state, ...indexBy((m) => m.id, action.messages) };

    case "fetch-message:request-successful":
      // Ignore messages already in cache to prevent rerenders. Updates should
      // be covered by server events anyway. Should be fine. Right? RIGHT?
      if (state[action.message.id] != null) return state;
      return { ...state, [action.message.id]: action.message };

    case "server-event:message-created":
      if (action.data.message.author === action.user?.id) {
        const optimisticEntries = Object.values(state).filter(
          (m) => m.isOptimistic
        );

        if (optimisticEntries.length > 0) return state;
      }

      return {
        ...state,
        [action.data.message.id]: {
          ...state[action.data.message.id],
          ...action.data.message,
        },
      };

    case "server-event:message-updated":
      return {
        ...state,
        [action.data.message.id]: {
          ...state[action.data.message.id],
          ...action.data.message,
        },
      };

    case "server-event:message-removed":
      return omitKey(action.data.message.id, state);

    case "message-delete-request-successful":
      return {
        ...state,
        [action.messageId]: { ...state[action.messageId], deleted: true },
      };

    case "create-message:request-sent":
      return {
        ...state,
        [action.message.id]: { ...action.message, isOptimistic: true },
      };

    case "create-message:request-successful":
      return {
        // Remove the optimistic entry
        ...omitKey(action.optimisticEntryId, state),
        [action.message.id]: action.message,
      };

    case "create-message:request-failed":
      // Remove the optimistic entry
      return omitKey(action.optimisticEntryId, state);

    case "message-update-request-successful":
      return {
        ...state,
        [action.message.id]: action.message,
      };

    case "add-message-reaction:request-sent": {
      const message = state[action.messageId];
      const existingReaction = message.reactions.find(
        (r) => r.emoji === action.emoji
      );
      return {
        ...state,
        [action.messageId]: {
          ...message,
          reactions:
            existingReaction == null
              ? // Add a new reaction
                [
                  ...message.reactions,
                  { emoji: action.emoji, count: 1, users: [action.userId] },
                ]
              : // Update the existing one
                message.reactions.map((r) =>
                  r.emoji === action.emoji
                    ? {
                        ...r,
                        count: r.count + 1,
                        users: [...r.users, action.userId],
                      }
                    : r
                ),
        },
      };
    }

    case "remove-message-reaction:request-sent": {
      const message = state[action.messageId];
      const reaction = message.reactions.find((r) => r.emoji === action.emoji);
      return {
        ...state,
        [action.messageId]: {
          ...message,
          reactions:
            reaction.count === 1
              ? // Remove the reaction
                message.reactions.filter((r) => r.emoji !== action.emoji)
              : // Update the existing one
                message.reactions.map((r) =>
                  r.emoji === action.emoji
                    ? {
                        ...r,
                        count: r.count - 1,
                        users: r.users.filter(
                          (userId) => userId !== action.userId
                        ),
                      }
                    : r
                ),
        },
      };
    }

    // TODO: Update the reactions individually to prevent race conditions
    case "server-event:message-reaction-added":
    case "server-event:message-reaction-removed":
      return {
        ...state,
        [action.data.message.id]: action.data.message,
      };

    case "logout":
      return {};

    default:
      return state;
  }
};

const entryIdsByChannelId = (state = {}, action) => {
  switch (action.type) {
    case "fetch-messages:request-successful": {
      const messageIdsByChannelId = mapValues(
        (ms, channelId) => {
          const previousIds = state[channelId] ?? [];
          const newIds = ms.map((m) => m.id);
          return unique([...previousIds, ...newIds]);
        },
        groupBy((m) => m.channelId, action.messages)
      );

      return { ...state, ...messageIdsByChannelId };
    }

    case "fetch-message:request-successful": {
      const { channelId } = action.message;
      const channelMessageIds = state[channelId] ?? [];

      return {
        ...state,
        [channelId]: unique([...channelMessageIds, action.message]),
      };
    }

    case "server-event:message-created": {
      const { channelId } = action.data.message;
      const channelMessageIds = state[channelId] ?? [];
      return {
        ...state,
        [channelId]: unique([...channelMessageIds, action.data.message.id]),
      };
    }

    case "create-message:request-sent": {
      const { channelId } = action.message;
      const channelMessageIds = state[channelId] ?? [];
      return {
        ...state,
        [channelId]: unique([...channelMessageIds, action.message.id]),
      };
    }

    case "create-message:request-successful": {
      const { channelId } = action.message;
      const channelMessageIds = state[channelId] ?? [];
      return {
        ...state,
        [channelId]: unique([
          // Remove the optimistic entry
          ...channelMessageIds.filter((id) => id !== action.optimisticEntryId),
          action.message.id,
        ]),
      };
    }

    case "create-message:request-failed": {
      const { channelId } = action;
      const channelMessageIds = state[channelId] ?? [];
      return {
        ...state,
        // Remove the optimistic entry
        [channelId]: channelMessageIds.filter(
          (id) => id !== action.optimisticEntryId
        ),
      };
    }

    case "server-event:message-removed":
      return mapValues(
        (messageIds) =>
          messageIds.filter((id) => id !== action.data.message.id),
        state
      );
    case "message-delete-request-successful":
      return mapValues(
        (messageIds) => messageIds.filter((id) => id !== action.messageId),
        state
      );

    case "logout":
      return {};

    default:
      return state;
  }
};

export const selectMessage = createSelector(
  (state, messageId) => state.messages.entriesById[messageId],
  (state, messageId) => {
    const message = state.messages.entriesById[messageId];
    if (message == null) return null;
    return selectUser(state, message.authorUserId);
  },
  (state, messageId) => {
    const message = state.messages.entriesById[messageId];
    if (message == null || message.inviterUserId == null) return null;
    return selectUser(state, message.inviterUserId);
  },
  (state, messageId) => {
    const message = state.messages.entriesById[messageId];
    if (message == null || message.installerUserId == null) return null;
    return selectUser(state, message.installerUserId);
  },
  (state) => state.me.user?.id,
  (state, messageId) => {
    const message = state.messages.entriesById[messageId];
    if (message == null || !message.appId) return null;
    return selectApp(state, message.appId);
  },
  (state) => state.users.blockedUserIds,
  (
    rawMessage,
    author,
    inviter,
    installer,
    loggedInUserId,
    app,
    blockedUserIds
  ) => {
    if (rawMessage == null || rawMessage.type == null) return null;

    const isBlocked =
      rawMessage.type === "regular" &&
      blockedUserIds.includes(rawMessage.authorUserId);

    const reactions =
      rawMessage.reactions?.map((r) => ({
        ...r,
        hasReacted: r.users.includes(loggedInUserId),
      })) ?? [];

    return {
      ...rawMessage,
      isBlocked,
      author,
      reactions,
      installer,
      inviter,
      app,
    };
  },
  { memoizeOptions: { maxSize: 1000 } }
);

export const selectHasReacted = (state, messageId, emoji) => {
  const meId = state.me.user?.id;
  const message = state.messages.entriesById[messageId];

  if (meId == null || message == null || message.reactions == null)
    return false;

  const reaction = message.reactions.find((r) => r.emoji === emoji);

  return reaction != null && reaction.users.some((userId) => userId === meId);
};

export const selectSortedChannelMessageIds = createSelector(
  (state, channelId) => {
    const messageIds = state.messages.entryIdsByChannelId[channelId];

    if (messageIds == null) return [];

    const messages = messageIds
      .map((messageId) => selectMessage(state, messageId))
      .filter((m) => m != null && !m.deleted);

    const sortedMessages = sort(
      (m1, m2) => new Date(m1.createdAt) - new Date(m2.createdAt),
      messages
    );

    return sortedMessages.map((m) => m.id);
  },
  (messages) => messages,
  { memoizeOptions: { maxSize: 100, equalityCheck: arrayShallowEquals } }
);

export const selectChannelMessages = createSelector(
  (state, channelId) => {
    const channelMessageIds =
      state.messages.entryIdsByChannelId[channelId] ?? [];
    return channelMessageIds
      .map((messageId) => selectMessage(state, messageId))
      .filter((m) => m != null && !m.deleted);
  },
  (messages) => messages,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export default combineReducers({ entriesById, entryIdsByChannelId });
