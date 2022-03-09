import { mapValues, omitKey } from "../utils/object";
import { indexBy, groupBy } from "../utils/array";
import combineReducers from "../utils/combine-reducers";

const entriesByUserId = (state = {}, action) => {
  switch (action.type) {
    case "initial-data-request-successful": {
      const members = action.data.servers.flatMap((s) => s.members);
      return indexBy((m) => m.user.id, members);
    }

    case "server-event:user-profile-updated":
      return {
        ...state,
        [action.data.user]: {
          ...state[action.data.user],
          user: {
            ...state[action.data.user].user,
            ...omitKey("user", action.data),
          },
        },
      };

    case "server-event:server-profile-updated":
      return {
        ...state,
        [action.data.user]: {
          ...state[action.data.user],
          ...omitKey("user", action.data),
        },
      };

    default:
      return state;
  }
};

const userIdsByServerId = (state = [], action) => {
  switch (action.type) {
    case "initial-data-request-successful": {
      const members = action.data.servers.flatMap((s) => s.members);
      const userIdsByServerId = mapValues(
        (members) => members.map((m) => m.user.id),
        groupBy((m) => m.server, members)
      );

      return userIdsByServerId;
    }

    default:
      return state;
  }
};

export const selectServerMembers = (state) => (serverId) => {
  const userIds = state.serverMembers.userIdsByServerId[serverId] ?? [];
  return userIds.map((id) => state.serverMembers.entriesByUserId[id]);
};

export const selectServerMembersByUserId = (state) => (serverId) => {
  const userIds = state.serverMembers.userIdsByServerId[serverId] ?? [];

  const members = userIds.map((id) => {
    const member = state.serverMembers.entriesByUserId[id];
    const displayName =
      member.display_name != null && member.display_name !== ""
        ? member.display_name
        : member.user.display_name;
    return {
      ...member,
      displayName,
      // TODO: Use real address
      walletAddress: member.user.id,
    };
  });

  return indexBy((m) => m.user.id, members);
};

export default combineReducers({ entriesByUserId, userIdsByServerId });
