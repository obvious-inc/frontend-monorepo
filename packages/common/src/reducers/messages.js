import combineReducers from "../utils/combine-reducers";
import { indexBy, groupBy, unique } from "../utils/array";
import { omitKey, mapValues } from "../utils/object";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "messages-fetched":
      return { ...state, ...indexBy((m) => m.id, action.messages) };

    case "server-event:message-created":
    case "server-event:message-updated":
      return {
        ...state,
        [action.data.message.id]: action.data.message,
      };

    case "server-event:message-removed":
      return omitKey(action.data.message.id, state);

    case "message-delete-request-successful":
      return omitKey(action.messageId, state);

    case "message-create-request-sent":
      return {
        ...state,
        [action.message.id]: action.message,
      };

    case "message-create-request-successful":
      return {
        // Remove the optimistic entry
        ...omitKey(action.optimisticEntryId, state),
        [action.message.id]: action.message,
      };
    case "message-update-request-successful":
      return {
        ...state,
        [action.message.id]: action.message,
      };

    default:
      return state;
  }
};

const entryIdsByChannelId = (state = {}, action) => {
  switch (action.type) {
    case "messages-fetched": {
      const messageIdsByChannelId = mapValues(
        (ms) => ms.map((m) => m.id),
        groupBy((m) => m.channel, action.messages)
      );

      return { ...state, ...messageIdsByChannelId };
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
        [channelId]: [...channelMessageIds, action.message.id],
      };
    }

    case "message-create-request-successful": {
      const channelId = action.message.channel;
      const channelMessageIds = state[channelId] ?? [];
      return {
        ...state,
        [channelId]: [
          // Remove the optimistic entry
          ...channelMessageIds.filter((id) => id !== action.optimisticEntryId),
          action.message.id,
        ],
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

    default:
      return state;
  }
};

export const selectChannelMessages = (state) => (channelId) => {
  const channelMessageIds = state.messages.entryIdsByChannelId[channelId] ?? [];
  return channelMessageIds.map((id) => state.messages.entriesById[id]);
};

export default combineReducers({ entriesById, entryIdsByChannelId });
