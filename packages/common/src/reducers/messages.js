import { createSelector } from "reselect";
import combineReducers from "../utils/combine-reducers";
import { indexBy, groupBy, unique, sort } from "../utils/array";
import { omitKey, mapValues } from "../utils/object";
import { arrayShallowEquals } from "../utils/reselect";
import { stringifyBlocks as stringifyMessageBlocks } from "../utils/message";
import { selectChannelLastReadAt } from "./channels";
import { selectUser } from "./users";
import { selectApp } from "./apps";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "fetch-messages:request-successful":
    case "fetch-user-messages:request-successful":
    case "fetch-reply-target-messages:request-successful":
      return { ...state, ...indexBy((m) => m.id, action.messages) };

    case "fetch-message:request-successful":
      // Ignore messages already in cache to prevent rerenders. Updates should
      // be covered by server events anyway. Should be fine. Right? RIGHT?
      if (state[action.message.id] != null) return state;
      return { ...state, [action.message.id]: action.message };

    case "server-event:message-created":
      if (action.data.message.author === action.user?.id) {
        const optimisticEntries = Object.values(state).filter(
          (m) => m.isOptimistic,
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
        (r) => r.emoji === action.emoji,
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
                    : r,
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
                          (userId) => userId !== action.userId,
                        ),
                      }
                    : r,
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

const createIndexReducer = (propertyName) => {
  const getIdAndProperty = (m) => ({
    id: m.id,
    property: m[propertyName],
  });

  return (state = {}, action) => {
    switch (action.type) {
      case "fetch-messages:request-successful":
      case "fetch-user-messages:request-successful":
      case "fetch-reply-target-messages:request-successful": {
        const messageIdsByProperty = mapValues(
          (ms, property) => {
            const previousIds = state[property] ?? [];
            const newIds = ms.map((m) => m.id);
            return unique([...previousIds, ...newIds]);
          },
          groupBy((m) => m[propertyName], action.messages),
        );

        return { ...state, ...messageIdsByProperty };
      }

      case "fetch-message:request-successful": {
        const { id, property } = getIdAndProperty(action.message);
        if (property == null) return state;
        const messageIds = state[property] ?? [];
        return {
          ...state,
          [property]: unique([...messageIds, id]),
        };
      }

      case "server-event:message-created": {
        const { id, property } = getIdAndProperty(action.data.message);
        if (property == null) return state;
        const messageIds = state[property] ?? [];
        return {
          ...state,
          [property]: unique([...messageIds, id]),
        };
      }

      case "create-message:request-sent": {
        const { id, property } = getIdAndProperty(action.message);
        if (property == null) return state;
        const messageIds = state[property] ?? [];
        return {
          ...state,
          [property]: unique([...messageIds, id]),
        };
      }

      case "create-message:request-successful": {
        const { id, property } = getIdAndProperty(action.message);
        if (property == null) return state;
        const messageIds = state[property] ?? [];
        return {
          ...state,
          [property]: unique([
            // Remove the optimistic entry
            ...messageIds.filter((id) => id !== action.optimisticEntryId),
            id,
          ]),
        };
      }

      case "create-message:request-failed": {
        const { property } = getIdAndProperty({ channelId: action.channelId });
        const messageIds = state[property] ?? [];
        return {
          ...state,
          // Remove the optimistic entry
          [property]: messageIds.filter(
            (id) => id !== action.optimisticEntryId,
          ),
        };
      }

      case "server-event:message-removed":
        return mapValues(
          (messageIds) =>
            messageIds.filter((id) => id !== action.data.message.id),
          state,
        );

      case "message-delete-request-successful":
        return mapValues(
          (messageIds) => messageIds.filter((id) => id !== action.messageId),
          state,
        );

      case "logout":
        return {};

      default:
        return state;
    }
  };
};

const entryIdsByChannelId = createIndexReducer("channelId");

const entryIdsByReplyTargetMessageId = createIndexReducer(
  "replyTargetMessageId",
);

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
  (state, messageId, { replies = false } = {}) => {
    if (!replies) return null;
    return selectReplyMessageIds(state, messageId);
  },
  (state, messageId, { readState = false } = {}) => {
    if (!readState) return null;
    const message = state.messages.entriesById[messageId];
    const channelLastReadAt = selectChannelLastReadAt(state, message.channelId);
    if (channelLastReadAt == null) return false;
    return new Date(message.createdAt) > new Date(channelLastReadAt);
  },
  (
    rawMessage,
    author,
    inviter,
    installer,
    loggedInUserId,
    app,
    blockedUserIds,
    replyMessageIds,
    isUnread,
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

    const message = {
      ...rawMessage,
      isBlocked,
      author,
      reactions,
      installer,
      inviter,
      app,
    };

    if (replyMessageIds != null) message.replyMessageIds = replyMessageIds;
    if (typeof isUnread === "boolean") message.isUnread = isUnread;

    return message;
  },
  { memoizeOptions: { maxSize: 1000 } },
);

export const selectReplyMessageIds = (state, messageId) =>
  state.messages.entryIdsByReplyTargetMessageId[messageId];

export const selectHasReacted = (state, messageId, emoji) => {
  const meId = state.me.user?.id;
  const message = state.messages.entriesById[messageId];

  if (meId == null || message == null || message.reactions == null)
    return false;

  const reaction = message.reactions.find((r) => r.emoji === emoji);

  return reaction != null && reaction.users.some((userId) => userId === meId);
};

export const selectSortedChannelMessageIds = createSelector(
  (state, channelId, { threads = true } = {}) => {
    const messageIds = state.messages.entryIdsByChannelId[channelId];

    if (messageIds == null) return [];

    const messages = messageIds
      .map((messageId) => selectMessage(state, messageId))
      .filter((m) => {
        if (m == null || m.deleted) return false;
        if (!threads || m.replyTargetMessageId == null) return true;
        // Exclude thread messages
        const messageIds =
          state.messages.entryIdsByReplyTargetMessageId[m.replyTargetMessageId];
        const isThread = messageIds != null && messageIds.length >= 2;
        return !isThread;
      });

    const sortedMessages = sort(
      (m1, m2) => new Date(m1.createdAt) - new Date(m2.createdAt),
      messages,
    );

    return sortedMessages.map((m) => m.id);
  },
  (messages) => messages,
  { memoizeOptions: { maxSize: 100, equalityCheck: arrayShallowEquals } },
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
  { memoizeOptions: { equalityCheck: arrayShallowEquals, maxSize: 1000 } },
);

export const selectSortedMessageReplies = createSelector(
  (state, messageId) => {
    const messageIds = selectReplyMessageIds(state, messageId);
    return messageIds
      .map((messageId) => selectMessage(state, messageId))
      .filter((m) => m != null && !m.deleted);
  },
  (messages) =>
    sort((m1, m2) => new Date(m1.createdAt) - new Date(m2.createdAt), messages),
  { memoizeOptions: { equalityCheck: arrayShallowEquals } },
);

export const selectStringifiedMessageContent = (state, messageId) => {
  const message = selectMessage(state, messageId);

  if (message == null) return null;

  if (message.isSystemMessage) {
    // ~Mirror of `SystemMessageContent` in channel-message.js
    const authorDisplayName = message.author?.computedDisplayName ?? "...";
    switch (message.type) {
      case "app-installed":
        return `${authorDisplayName} installed a new app: ${
          message.app?.name ?? "..."
        }`;

      case "user-invited":
        return `${
          message.inviter?.computedDisplayName ?? "..."
        } added ${authorDisplayName} to the topic.`;

      case "member-joined":
        return `${authorDisplayName} joined the topic. Welcome!`;

      case "channel-updated": {
        const updates = Object.entries(message.updates);
        if (updates.length == 0 || updates.length > 1)
          return `${authorDisplayName} updated the topic.`;

        const [field, value] = updates[0];

        // Nested switch case baby!
        switch (field) {
          case "name":
          case "topic":
            return `${authorDisplayName} ${
              (value ?? "") === ""
                ? `cleared the topic ${field}`
                : `set the topic ${field}: ${value}`
            }`;

          default:
            return `${authorDisplayName} updated the topic ${field}.`;
        }
      }
    }
  }

  return stringifyMessageBlocks(message.content, {
    renderUser: (id) => id,
    renderChannelLink: (id) => id,
  });
};

export default combineReducers({
  entriesById,
  entryIdsByChannelId,
  entryIdsByReplyTargetMessageId,
});
