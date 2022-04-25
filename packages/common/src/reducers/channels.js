import { createSelector } from "reselect";
import combineReducers from "../utils/combine-reducers";
import { indexBy, unique, sort } from "../utils/array";
import { getMentions } from "../utils/message";
import { arrayShallowEquals } from "../utils/reselect";
import { selectUser } from "./users";
import {
  selectServerMembers,
  selectServerMemberWithUserId,
} from "./server-members";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "initial-data-request-successful": {
      const readStatesByChannelId = indexBy(
        (s) => s.channel,
        action.data.read_states
      );

      const allChannels = [
        ...action.data.servers.flatMap((s) =>
          s.channels.map((c) => ({ ...c, serverId: s.id }))
        ),
        ...action.data.dms,
      ];

      const channelsById = indexBy((c) => c.id, allChannels);

      const entriesById = Object.fromEntries(
        Object.entries(channelsById).map(([id, channel]) => {
          const readStates = readStatesByChannelId[id];
          const properties = {
            id,
            name: channel.name,
            kind: channel.kind,
            serverId: channel.serverId,
            lastMessageAt: channel.last_message_at,
            createdAt: channel.created_at,
            lastReadAt: readStates?.last_read_at ?? null,
            unreadMentionMessageIds: Array(readStates?.mention_count ?? 0).fill(
              null
            ),
          };
          if (channel.kind === "dm") {
            properties.memberUserIds = channel.members;
            properties.ownerUserId = channel.owner;
          }
          return [id, properties];
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
      const unreadMentionMessageIds = channel?.unreadMentionMessageIds ?? [];

      return {
        ...state,
        [action.data.message.channel]: {
          ...channel,
          lastMessageAt: action.data.message.created_at,
          lastReadAt: isOwnMessage
            ? action.data.message.created_at
            : channel?.lastReadAt,
          unreadMentionMessageIds:
            userMentions.length === 0
              ? unreadMentionMessageIds
              : [...unreadMentionMessageIds, action.data.message.id],
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

export const selectChannel = createSelector(
  (state, channelId) => state.channels.entriesById[channelId],
  (state) => state.user,
  (state, channelId) => {
    const channel = state.channels.entriesById[channelId];
    if (channel == null) return null;
    return selectServerMemberWithUserId(state, channel.serverId, state.user.id);
  },
  (state, channelId) => {
    const channel = state.channels.entriesById[channelId];
    if (channel == null || channel.kind !== "dm") return null;
    return channel.memberUserIds.map((userId) => selectUser(state, userId));
  },
  (channel, loggedInUser, loggedInServerMember, channelMemberUsers) => {
    if (channel == null) return null;

    const getLastReadTimestamp = () => {
      if (channel.kind === "dm")
        return channel.lastReadAt == null
          ? new Date().getTime()
          : new Date(channel.lastReadAt).getTime();

      const serverJoinTimestamp = new Date(
        loggedInServerMember.joinedAt
      ).getTime();

      return channel.lastReadAt == null
        ? serverJoinTimestamp
        : new Date(channel.lastReadAt).getTime();
    };

    const buildName = () => {
      if (channel.kind !== "dm" || channel.name != null) return channel.name;

      if (channel.memberUserIds.length === 1) return "Me";

      return channelMemberUsers
        .filter((u) => u.id !== loggedInUser.id)
        .map((u) => u?.displayName)
        .filter(Boolean)
        .join(", ");
    };

    const lastReadTimestamp = getLastReadTimestamp();

    const lastMessageTimestamp = new Date(channel.lastMessageAt).getTime();

    return {
      ...channel,
      name: buildName(),
      hasUnread: lastReadTimestamp < lastMessageTimestamp,
      mentionCount: channel.unreadMentionMessageIds.length,
    };
  },
  { memoizeOptions: { maxSize: 1000 } }
);

export const selectDmChannelFromUserId = (state, userId) => {
  const dmChannels = selectDmChannels(state);
  const userDmChannels = dmChannels.filter(
    (c) => c.memberUserIds.length <= 2 && c.memberUserIds.includes(userId)
  );

  if (userDmChannels.length > 1) throw new Error();

  return userDmChannels[0];
};

export const selectDmChannelFromUserIds = (state, userIds) => {
  const dmChannels = selectDmChannels(state);
  return dmChannels.find(
    (c) =>
      c.memberUserIds.length === userIds.length &&
      c.memberUserIds.every((id) => userIds.includes(id))
  );
};

export const selectServerChannels = createSelector(
  (state, serverId) =>
    Object.values(state.channels.entriesById)
      .filter((channel) => channel.serverId === serverId)
      .map((c) => selectChannel(state, c.id)),
  (channels) => channels,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectDmChannels = createSelector(
  (state) => {
    const channels = Object.values(state.channels.entriesById)
      .filter((channel) => channel.kind === "dm")
      .map((c) => selectChannel(state, c.id));

    return sort((c1, c2) => {
      const [t1, t2] = [c1, c2].map((c) =>
        new Date(c.lastMessageAt ?? c.createdAt).getTime()
      );
      return t1 > t2 ? -1 : t1 < t2 ? 1 : 0;
    }, channels);
  },
  (channels) => channels,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectServerDmChannels = createSelector(
  (state, serverId) => {
    const memberUserIds = selectServerMembers(state, serverId).map((m) => m.id);
    return selectDmChannels(state).filter((c) =>
      c.memberUserIds.every((userId) => memberUserIds.includes(userId))
    );
  },
  (channels) => channels,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export default combineReducers({ entriesById });
