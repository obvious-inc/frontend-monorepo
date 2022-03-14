import combineReducers from "../utils/combine-reducers";
import { indexBy, unique } from "../utils/array";
import { getMentions } from "../utils/message";
import { selectServerMemberWithUserId } from "./server-members";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "initial-data-request-successful": {
      const readStatesByChannelId = indexBy(
        (s) => s.channel,
        action.data.read_states
      );

      const channelsById = indexBy(
        (c) => c.id,
        action.data.servers.flatMap((s) =>
          s.channels.map((c) => ({ ...c, serverId: s.id }))
        )
      );

      const entriesById = Object.fromEntries(
        Object.entries(channelsById).map(([id, channel]) => {
          const readStates = readStatesByChannelId[id];
          return [
            id,
            {
              id,
              name: channel.name,
              serverId: channel.serverId,
              lastMessageAt: channel.last_message_at,
              lastReadAt: readStates?.last_read_at ?? null,
              unreadMentionMessageIds: Array(
                readStates?.mention_count ?? 0
              ).fill(null),
            },
          ];
        })
      );

      return {
        ...state,
        ...entriesById,
      };
    }

    case "mark-channel-read":
      return {
        ...state,
        [action.data.channelId]: {
          ...state[action.data.channelId],
          lastReadAt: action.data.date.toISOString(),
          unreadMentionMessageIds: [],
        },
      };

    case "message-create-request-sent":
    case "message-create-request-successful":
      return {
        ...state,
        [action.message.channel]: {
          ...state[action.message.channel],
          lastReadAt: action.message.created_at,
          lastMessageAt: action.message.created_at,
        },
      };

    case "server-event:message-created": {
      const isOwnMessage = action.data.message.author === action.user.id;
      const channel = state[action.data.message.channel];

      const userMentions = getMentions(action.data.message.blocks).filter(
        (m) => m.ref === action.user.id
      );

      return {
        ...state,
        [action.data.message.channel]: {
          ...channel,
          lastMessageAt: action.data.message.created_at,
          lastReadAt: isOwnMessage
            ? action.data.message.created_at
            : channel.lastReadAt,
          unreadMentionMessageIds:
            userMentions.length === 0
              ? channel.unreadMentionMessageIds
              : [...channel.unreadMentionMessageIds, action.data.message.id],
        },
      };
    }

    case "server-event:message-removed": {
      const channel = state[action.data.message.channel];
      return {
        ...state,
        [action.data.message.channel]: {
          ...channel,
          unreadMentionMessageIds: channel.unreadMentionMessageIds.filter(
            (id) => id !== action.data.message.id
          ),
        },
      };
    }

    case "server-event:message-updated": {
      const channel = state[action.data.message.channel];
      const messageId = action.data.message.id;
      const userMentions = getMentions(action.data.message.blocks).filter(
        (m) => m.ref === action.user.id
      );

      return {
        ...state,
        [action.data.message.channel]: {
          ...channel,
          unreadMentionMessageIds:
            userMentions.length === 0
              ? channel.unreadMentionMessageIds.filter((id) => id !== messageId)
              : unique([...channel.unreadMentionMessageIds, messageId]),
        },
      };
    }

    default:
      return state;
  }
};

export const selectChannel = (state) => (id) => {
  const channel = state.channels.entriesById[id];

  if (channel == null) return null;

  const userServerMember = selectServerMemberWithUserId(state)(
    channel.serverId,
    state.user.id
  );

  const serverJoinTimestamp = new Date(userServerMember.joined_at).getTime();

  const lastReadTimestamp =
    channel.lastReadAt == null
      ? serverJoinTimestamp
      : new Date(channel.lastReadAt).getTime();

  const lastMessageTimestamp = new Date(channel.lastMessageAt).getTime();

  return {
    ...channel,
    hasUnread: lastReadTimestamp < lastMessageTimestamp,
    mentionCount: channel.unreadMentionMessageIds.length,
  };
};

export const selectServerChannels = (state) => (serverId) => {
  return Object.values(state.channels.entriesById)
    .filter((channel) => channel.serverId === serverId)
    .map((c) => selectChannel(state)(c.id));
};

export default combineReducers({ entriesById });
