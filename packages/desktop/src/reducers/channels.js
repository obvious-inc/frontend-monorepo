import combineReducers from "../utils/combine-reducers";
import { indexBy } from "../utils/array";
import { mapValues } from "../utils/object";
import { selectServer } from "./servers";

const readTimestampByChannelId = (state = {}, action) => {
  switch (action.type) {
    case "server-event:user-data": {
      const timestampsByChannelId = mapValues(
        (s) => new Date(s.last_read_at).getTime(),
        indexBy((s) => s.channel, action.data.read_states)
      );
      return {
        ...state,
        ...timestampsByChannelId,
      };
    }

    case "mark-channel-read":
      return {
        ...state,
        [action.data.channelId]: action.data.date.getTime(),
      };

    case "message-create-request-sent":
    case "message-create-request-successful":
      return {
        ...state,
        [action.message.channel]: new Date(action.message.created_at).getTime(),
      };

    case "server-event:message-created": {
      // Mark channels as read when receiving the user’s own messages.
      // This only matters when the same user is logged in on multiple clients.
      if (action.data.message.author === action.user.id)
        return {
          ...state,
          [action.data.message.channel]: new Date(action.data.message.created_at).getTime(),
        };

      return state;
    }

    default:
      return state;
  }
};

const lastMessageTimestampByChannelId = (state = {}, action) => {
  switch (action.type) {
    case "server-event:user-data": {
      const allChannels = action.data.servers.flatMap((s) => s.channels);
      const timestampsByChannelId = mapValues(
        (c) => new Date(c.last_message_at).getTime(),
        indexBy((c) => c.id, allChannels)
      );
      return {
        ...state,
        ...timestampsByChannelId,
      };
    }

    case "server-event:message-created":
      return {
        ...state,
        [action.data.message.channel]: new Date(action.data.message.created_at).getTime(),
      };

    default:
      return state;
  }
};

export const selectServerChannels = (state) => (serverId) => {
  const server = selectServer(state)(serverId);

  if (server == null) return [];

  return server.channels.map((c) => {
    const lastReadTimestamp = state.channels.readTimestampByChannelId[c.id];
    const lastMessageTimestamp =
      state.channels.lastMessageTimestampByChannelId[c.id];
    return {
      ...c,
      hasUnread:
        lastReadTimestamp == null || lastReadTimestamp < lastMessageTimestamp,
    };
  });
};

export default combineReducers({
  readTimestampByChannelId,
  lastMessageTimestampByChannelId,
});
