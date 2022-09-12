import { createSelector } from "reselect";
import combineReducers from "../utils/combine-reducers";
import { indexBy, groupBy, unique } from "../utils/array";
import { omitKey, mapValues } from "../utils/object";
import { arrayShallowEquals } from "../utils/reselect";
import { selectUser } from "./users";
import { selectApp } from "./apps";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "messages-fetched":
      return { ...state, ...indexBy((m) => m.id, action.messages) };

    case "message-fetched":
      // Ignore messages already in cache to prevent rerenders. Updates should
      // be covered by server events anyway. Should be fine. Right? RIGHT?
      if (state[action.message.id] != null) return state;
      return { ...state, [action.message.id]: action.message };

    case "server-event:message-created":
      if (action.data.message.author === action.user.id) {
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

    case "message-fetch-request-successful":
      return { ...state, [action.message.id]: action.message };

    case "message-delete-request-successful":
      return omitKey(action.messageId, state);

    case "message-create-request-sent":
      return {
        ...state,
        [action.message.id]: { ...action.message, isOptimistic: true },
      };

    case "message-create-request-successful":
      return {
        // Remove the optimistic entry
        ...omitKey(action.optimisticEntryId, state),
        [action.message.id]: action.message,
      };

    case "message-create-request-failed":
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
    case "messages-fetched": {
      const messageIdsByChannelId = mapValues(
        (ms, channelId) => {
          const previousIds = state[channelId] ?? [];
          const newIds = ms.map((m) => m.id);
          return unique([...previousIds, ...newIds]);
        },
        groupBy((m) => m.channel, action.messages)
      );

      return { ...state, ...messageIdsByChannelId };
    }

    case "message-fetched": {
      const channelId = action.message.channel;
      const channelMessageIds = state[channelId] ?? [];

      return {
        ...state,
        [channelId]: unique([...channelMessageIds, action.message]),
      };
    }

    case "server-event:message-created": {
      const channelId = action.data.message.channel;
      const channelMessageIds = state[channelId] ?? [];
      return {
        ...state,
        [channelId]: unique([...channelMessageIds, action.data.message.id]),
      };
    }

    case "message-create-request-sent": {
      const channelId = action.message.channel;
      const channelMessageIds = state[channelId] ?? [];
      return {
        ...state,
        [channelId]: unique([...channelMessageIds, action.message.id]),
      };
    }

    case "message-create-request-successful": {
      const channelId = action.message.channel;
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

    case "message-create-request-failed": {
      const channelId = action.channelId;
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

const systemMessageTypes = ["member-joined", "user-invited", "channel-updated"];
const appMessageTypes = ["webhook", "app", "app-installed"];

const deriveMessageType = (message) => {
  switch (message.type) {
    case undefined:
    case 0:
      return "regular";
    case 1:
      if (message.inviter) return "user-invited";
      return "member-joined";
    case 2:
    case 3:
      return "webhook";
    case 5:
      return "channel-updated";
    case 6:
      return "app-installed";
    default:
      console.warn(`Unknown message type "${message.type}"`);
  }
};

export const selectMessage = createSelector(
  (state, messageId) => state.messages.entriesById[messageId],
  (state, messageId) => {
    const message = state.messages.entriesById[messageId];
    if (message == null) return null;
    return selectUser(state, message.author);
  },
  (state, messageId) => {
    const message = state.messages.entriesById[messageId];
    if (message == null || message.inviter == null) return null;
    return selectUser(state, message.inviter);
  },
  (state, messageId) => {
    const message = state.messages.entriesById[messageId];
    if (message == null || message.installer == null) return null;
    return selectUser(state, message.installer);
  },
  (state, messageId) => {
    const message = state.messages.entriesById[messageId];
    if (message == null || message.reply_to == null) return null;
    return selectMessage(state, message.reply_to);
  },
  (state) => state.me.user,
  (state, messageId) => {
    const message = state.messages.entriesById[messageId];
    if (message == null || !message.app) return null;
    return selectApp(state, message.app);
  },
  (message, author, inviter, installer, repliedMessage, loggedInUser, app) => {
    if (message == null) return null;
    if (message.deleted) return message;

    const type = deriveMessageType(message);

    if (type == null) return null;

    const isSystemMessage = systemMessageTypes.includes(type);
    const isAppMessage = appMessageTypes.includes(type);

    const serverId = message.server;
    const appId = message.app;
    const authorUserId = message.author;
    const inviterUserId = message.inviter;
    const installerUserId = message.installer;
    const authorId = isSystemMessage
      ? "system"
      : isAppMessage
      ? appId
      : authorUserId;

    if (message.reply_to != null) {
      message.repliedMessage = repliedMessage;
      message.isReply = true;
    }

    return {
      ...message,
      createdAt: message.created_at,
      serverId,
      channelId: message.channel,
      authorUserId,
      authorId,
      isEdited: message.edited_at != null,
      type,
      isSystemMessage,
      isAppMessage,
      isOptimistic: message.isOptimistic,
      author,
      inviterUserId,
      inviter,
      installerUserId,
      installer,
      content:
        message.blocks?.length > 0
          ? message.blocks
          : [{ type: "paragraph", children: [{ text: message.content }] }],
      stringContent: message.content,
      reactions:
        message.reactions?.map((r) => ({
          ...r,
          hasReacted: r.users.includes(loggedInUser?.id),
        })) ?? [],
      appId,
      app,
    };
  },
  { memoizeOptions: { maxSize: 1000 } }
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
