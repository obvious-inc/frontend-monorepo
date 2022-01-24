import combineReducers from "../utils/combine-reducers";
import { indexBy, groupBy } from "../utils/array";
import { omitKey, mapValues } from "../utils/object";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "messages-fetched":
      return { ...state, ...indexBy((m) => m.id, action.messages) };

    case "server-event:message-created":
      return {
        ...state,
        [action.message.id]: action.message,
      };

    case "message-create-request-sent":
      return {
        ...state,
        [action.message.id]: action.message,
      };

    case "message-create-request-successful":
      return {
        ...omitKey(action.dummyId, state),
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
      const channelId = action.message.channel;
      const channelMessageIds = state[channelId] ?? [];
      return {
        ...state,
        [channelId]: [...channelMessageIds, action.message.id],
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
          ...channelMessageIds.filter((id) => id !== action.dummyId),
          action.message.id,
        ],
      };
    }

    default:
      return state;
  }
};

export const selectChannelMessages = (state) => (channelId) => {
  const channelMessageIds = state.messages.entryIdsByChannelId[channelId] ?? [];
  return channelMessageIds.map((id) => state.messages.entriesById[id]);
};

export default combineReducers({ entriesById, entryIdsByChannelId });
