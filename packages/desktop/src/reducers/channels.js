import combineReducers from "../utils/combine-reducers";
import { indexBy } from "../utils/array";
import { mapValues } from "../utils/object";
import { selectServer } from "./servers";

const readTimestampByChannelId = (state = {}, action) => {
  switch (action.type) {
    case "server-event:user-data": {
      const timestampsByChannelId = mapValues(
        (s) => s.last_read_ts,
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
        [action.channelId]: action.date.getTime() / 1000,
      };

    default:
      return state;
  }
};

const lastMessageTimestampByChannelId = (state = {}, action) => {
  switch (action.type) {
    case "server-event:user-data": {
      const allChannels = action.data.servers.flatMap((s) => s.channels);
      const timestampsByChannelId = mapValues(
        (c) => c.last_message_ts,
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
        [action.data.channel]:
          new Date(action.data.created_at).getTime() / 1000,
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
      hasUnread: lastReadTimestamp < lastMessageTimestamp,
    };
  });
};

export default combineReducers({
  readTimestampByChannelId,
  lastMessageTimestampByChannelId,
});
