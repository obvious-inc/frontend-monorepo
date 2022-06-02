import { createSelector } from "reselect";
import combineReducers from "../utils/combine-reducers";
import { unique } from "../utils/array";
import { arrayShallowEquals } from "../utils/reselect";
import { selectUsers } from "./users";
import { selectServerMemberWithUserId } from "./server-members";

const typingUserIdsByChannelId = (state = {}, action) => {
  switch (action.type) {
    case "server-event:user-typed": {
      const channelId = action.data.channel.id;
      const channelTypingUserIds = state[channelId] ?? [];
      return {
        ...state,
        [channelId]: unique([...channelTypingUserIds, action.data.user.id]),
      };
    }

    case "server-event:message-created": {
      const channelId = action.data.message.channel;
      const authorUserId = action.data.message.author;
      return {
        ...state,
        [channelId]:
          state[channelId]?.filter((id) => id !== authorUserId) ?? [],
      };
    }

    case "user-typing-ended":
      return {
        ...state,
        [action.channelId]:
          state[action.channelId]?.filter((id) => id !== action.userId) ?? [],
      };

    case "logout":
      return {};

    default:
      return state;
  }
};

const selectServerChannelTypingServerMembers = createSelector(
  (state, channelId) => {
    const channel = state.channels.entriesById[channelId];
    if (channel == null) return [];
    const userIds =
      state.channelTypingStatus.typingUserIdsByChannelId[channelId] ?? [];
    return userIds.map((userId) =>
      selectServerMemberWithUserId(state, channel.serverId, userId)
    );
  },
  (members) => members,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

const selectDmChannelTypingUsers = createSelector(
  (state, channelId) => {
    const userIds =
      state.channelTypingStatus.typingUserIdsByChannelId[channelId] ?? [];
    return selectUsers(state, userIds);
  },
  (users) => users,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectChannelTypingMembers = createSelector(
  (state, channelId) => {
    const channel = state.channels.entriesById[channelId];
    if (channel == null) return [];

    const members =
      channel.kind === "dm"
        ? selectDmChannelTypingUsers(state, channelId)
        : selectServerChannelTypingServerMembers(state, channelId);

    return members.filter((m) => m.id !== state.user.id);
  },
  (members) => members,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export default combineReducers({ typingUserIdsByChannelId });
