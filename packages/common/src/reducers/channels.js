import { createSelector } from "reselect";
import combineReducers from "../utils/combine-reducers";
import { indexBy, unique, sort } from "../utils/array";
import { omitKey } from "../utils/object";
import { getMentions } from "../utils/message";
import { arrayShallowEquals } from "../utils/reselect";
import { selectUser } from "./users";

const parseChannel = (channel) => ({
  id: channel.id,
  name: channel.name,
  description: channel.description,
  avatar: channel.avatar,
  kind: channel.kind,
  createdAt: channel.created_at,
  memberUserIds: channel.members,
  ownerUserId: channel.owner,
});

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "fetch-client-boot-data-request-successful":
    case "fetch-user-channels-request-successful": {
      const parsedChannels = action.channels.map(parseChannel);
      const entriesById = indexBy((c) => c.id, parsedChannels);
      return { ...state, ...entriesById };
    }

    case "fetch-channel-request-successful": {
      const existingChannelData = state[action.channel.id];
      return {
        ...state,
        [action.channel.id]: {
          ...existingChannelData,
          ...parseChannel(action.channel),
        },
      };
    }

    case "fetch-channel-members-request-successful": {
      const existingChannelData = state[action.channelId];
      return {
        ...state,
        [action.channelId]: {
          ...existingChannelData,
          id: action.channelId,
          memberUserIds: action.members.map((m) => m.id),
        },
      };
    }

    case "delete-channel-request-successful":
      return omitKey(action.id, state);

    case "logout":
      return {};

    default:
      return state;
  }
};

const metaById = (state = {}, action) => {
  switch (action.type) {
    case "fetch-channel-public-permissions-request-successful": {
      const meta = state[action.channelId];
      return {
        ...state,
        [action.channelId]: { ...meta, publicPermissions: action.permissions },
      };
    }

    case "messages-fetched": {
      const config = state[action.channelId];
      const hasAllMessages = action.messages.length < action.limit;
      return {
        ...state,
        [action.channelId]: {
          ...config,
          hasAllMessages,
          hasFetchedMessages: true,
        },
      };
    }

    case "logout":
      return {};

    default:
      return state;
  }
};

const starsByChannelId = (state = [], action) => {
  switch (action.type) {
    case "fetch-starred-channels-request-successful":
      return indexBy((s) => s.channelId, action.stars);

    case "star-channel-request-successful":
      return { ...state, [action.star.channelId]: action.star };

    case "unstar-channel-request-successful":
      return omitKey(action.channelId, state);

    case "logout":
      return [];

    default:
      return state;
  }
};

const readStatesById = (state = {}, action) => {
  switch (action.type) {
    case "fetch-client-boot-data-request-successful":
    case "fetch-channels-read-states-request-successful": {
      const mergedReadStates = action.readStates.map((s) => {
        const existingState = state[s.channel];
        return {
          ...existingState,
          lastReadAt: s.last_read_at,
          unreadMentionMessageIds: Array(s.mention_count).fill(null),
        };
      });
      const entriesByChannelId = indexBy((s) => s.channel, mergedReadStates);
      return { ...state, ...entriesByChannelId };
    }

    // case "fetch-user-channels-request-successful": {
    //   const mergedReadStates = action.channels.map((c) => {
    //     const existingState = state[c.id];
    //     return {
    //       ...existingState,
    //       channelId: c.id,
    //       lastMessageAt: c.last_message_at,
    //     };
    //   });
    //   const entriesByChannelId = indexBy((s) => s.channelId, mergedReadStates);
    //   return { ...state, ...entriesByChannelId };
    // }

    case "mark-channel-read-request-sent":
      return {
        ...state,
        [action.channelId]: {
          ...state[action.channelId],
          lastReadAt: action.readAt.toISOString(),
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
      const channelState = state[action.data.message.channel];

      const userMentions = getMentions(action.data.message.blocks).filter(
        (m) => m.ref === action.user.id
      );
      const unreadMentionMessageIds =
        channelState?.unreadMentionMessageIds ?? [];

      return {
        ...state,
        [action.data.message.channel]: {
          ...channelState,
          lastMessageAt: action.data.message.created_at,
          lastReadAt: isOwnMessage
            ? action.data.message.created_at
            : channelState?.lastReadAt,
          unreadMentionMessageIds:
            userMentions.length === 0
              ? unreadMentionMessageIds
              : [...unreadMentionMessageIds, action.data.message.id],
        },
      };
    }

    case "server-event:message-removed": {
      const channelState = state[action.data.message.channel];
      return {
        ...state,
        [action.data.message.channel]: {
          ...channelState,
          unreadMentionMessageIds: channelState.unreadMentionMessageIds.filter(
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

    case "logout":
      return {};

    default:
      return state;
  }
};

export const selectChannel = createSelector(
  (state, channelId) => state.channels.entriesById[channelId],
  (state) => state.me.user,
  (state, channelId) => {
    const channel = state.channels.entriesById[channelId];
    if (channel == null || channel.kind !== "dm") return null;
    return channel.memberUserIds.map((userId) => selectUser(state, userId));
  },
  (channel, loggedInUser, channelMemberUsers) => {
    if (channel == null) return null;

    const buildName = () => {
      if (channel.kind !== "dm" || channel.name != null) return channel.name;

      if (channel.memberUserIds.length === 1) return "Me";

      return channelMemberUsers
        .filter((u) => u?.id !== loggedInUser?.id)
        .map((u) => u?.displayName)
        .filter(Boolean)
        .join(", ");
    };

    return {
      ...channel,
      name: buildName(),
      avatar: channel.avatar === "" ? null : channel.avatar,
      isAdmin: loggedInUser != null && loggedInUser.id === channel.ownerUserId,
    };
  },
  { memoizeOptions: { maxSize: 1000 } }
);

export const selectChannelMentionCount = createSelector(
  (state, channelId) => state.channels.readStatesById[channelId],
  (channelState) => {
    if (channelState == null || channelState.unreadMentionMessageIds == null)
      return 0;
    return channelState.unreadMentionMessageIds.length;
  },
  { memoizeOptions: { maxSize: 1000 } }
);

export const selectChannelHasUnread = createSelector(
  (state, channelId) => state.channels.readStatesById[channelId],
  (channelState /* channelKind, */ /* loggedInServerMember */) => {
    if (channelState == null) return false;

    const getLastReadTimestamp = () => {
      return channelState.lastReadAt == null
        ? new Date().getTime()
        : new Date(channelState.lastReadAt).getTime();

      // const channelJoinTimestamp =
      //   loggedInServerMember == null
      //     ? null
      //     : new Date(loggedInServerMember.joinedAt).getTime();

      // return channelState.lastReadAt == null
      //   ? null // channelJoinTimestamp
      //   : new Date(channelState.lastReadAt).getTime();
    };

    const lastReadTimestamp = getLastReadTimestamp();

    if (lastReadTimestamp == null) return false;

    const lastMessageTimestamp = new Date(channelState.lastMessageAt).getTime();

    return lastReadTimestamp < lastMessageTimestamp;
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

export const selectMemberChannels = createSelector(
  (state) => {
    if (state.me.user == null) return [];

    const channels = Object.entries(state.channels.entriesById)
      .filter((entry) => entry[1].memberUserIds?.includes(state.me.user.id))
      .map(([id]) => selectChannel(state, id));

    return sort((c1, c2) => {
      const [t1, t2] = [c1, c2].map((c) => {
        const readState = state.channels.readStatesById[c.id];
        return new Date(readState?.lastMessageAt ?? c.createdAt).getTime();
      });
      return t1 > t2 ? -1 : t1 < t2 ? 1 : 0;
    }, channels);
  },
  (channels) => channels,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectDmChannels = createSelector(
  (state) => {
    const channels = Object.entries(state.channels.entriesById)
      .filter((entry) => entry[1].kind === "dm")
      .map(([id]) => selectChannel(state, id));

    return sort((c1, c2) => {
      const [t1, t2] = [c1, c2].map((c) => {
        const readState = state.channels.readStatesById[c.id];
        return new Date(readState?.lastMessageAt ?? c.createdAt).getTime();
      });
      return t1 > t2 ? -1 : t1 < t2 ? 1 : 0;
    }, channels);
  },
  (channels) => channels,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectStarredChannels = createSelector(
  (state) =>
    Object.keys(state.channels.starsByChannelId)
      .map((id) => selectChannel(state, id))
      .filter(Boolean),
  (channels) => channels,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectIsChannelStarred = (state, id) =>
  selectChannelStarId(state, id) != null;

export const selectTopicChannels = createSelector(
  (state) => {
    const channels = Object.values(state.channels.entriesById)
      .filter((channel) => channel.kind === "topic")
      .map((c) => selectChannel(state, c.id));

    return sort((c1, c2) => {
      const [t1, t2] = [c1, c2].map((c) => {
        const readState = state.channels.readStatesById[c.id];
        return new Date(readState?.lastMessageAt ?? c.createdAt).getTime();
      });
      return t1 > t2 ? -1 : t1 < t2 ? 1 : 0;
    }, channels);
  },
  (channels) => channels,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectDmAndTopicChannels = createSelector(
  (state) => {
    const channels = [
      ...selectDmChannels(state),
      ...selectTopicChannels(state),
    ];

    return sort((c1, c2) => {
      const [t1, t2] = [c1, c2].map((c) => {
        const readState = state.channels.readStatesById[c.id];
        return new Date(readState?.lastMessageAt ?? c.createdAt).getTime();
      });
      return t1 > t2 ? -1 : t1 < t2 ? 1 : 0;
    }, channels);
  },
  (channels) => channels,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectChannelMembers = createSelector(
  (state, channelId) => {
    const channel = state.channels.entriesById[channelId];
    if (channel == null) return [];
    return channel.memberUserIds.map((id) => {
      const user = selectUser(state, id);
      return { ...user, id, isOwner: id === channel.ownerUserId };
    });
  },
  (members) => members,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectChannelStarId = (state, channelId) =>
  state.channels.starsByChannelId[channelId]?.id;

export const selectHasFetchedMessages = (state, channelId) =>
  state.channels.metaById[channelId]?.hasFetchedMessages ?? false;

export const selectHasAllMessages = (state, channelId) =>
  state.channels.metaById[channelId]?.hasAllMessages ?? false;

export const selectChannelAccessLevel = (state, channelId) => {
  const meta = state.channels.metaById[channelId];
  if (meta == null || meta.publicPermissions == null) return "unknown";
  return meta.publicPermissions.includes("channels.join")
    ? "public"
    : "private";
};

export default combineReducers({
  entriesById,
  metaById,
  readStatesById,
  starsByChannelId,
});
