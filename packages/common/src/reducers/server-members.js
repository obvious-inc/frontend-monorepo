import { mapValues } from "../utils/object";
import { indexBy, groupBy } from "../utils/array";
import combineReducers from "../utils/combine-reducers";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "initial-data-request-successful": {
      const members = action.data.servers.flatMap((s) => s.members);
      return indexBy((m) => m.id, members);
    }

    case "server-event:user-profile-updated":
      return mapValues((member) => {
        if (member.user.id !== action.data.user) return member;
        return {
          ...member,
          user: {
            ...member.user,
            display_name: action.data.display_name,
          },
        };
      }, state);

    case "server-event:server-profile-updated":
      return {
        ...state,
        [action.data.member]: {
          ...state[action.data.member],
          display_name: action.data.display_name,
        },
      };

    default:
      return state;
  }
};

const memberIdsByServerId = (state = [], action) => {
  switch (action.type) {
    case "initial-data-request-successful": {
      const members = action.data.servers.flatMap((s) => s.members);
      const memberIdsByServerId = mapValues(
        (members) => members.map((m) => m.id),
        groupBy((m) => m.server, members)
      );

      return memberIdsByServerId;
    }

    default:
      return state;
  }
};

const memberIdsByUserId = (state = [], action) => {
  switch (action.type) {
    case "initial-data-request-successful": {
      const members = action.data.servers.flatMap((s) => s.members);
      const membersByUserId = groupBy((m) => m.user.id, members);
      const memberIdsByUserId = mapValues(
        (members) => members.map((m) => m.id),
        membersByUserId
      );

      return memberIdsByUserId;
    }

    default:
      return state;
  }
};

export const selectServerMember = (state) => (id) => {
  const member = state.serverMembers.entriesById[id];

  const displayName =
    member.display_name != null && member.display_name !== ""
      ? member.display_name
      : member.user.display_name;

  return {
    ...member,
    displayName,
    walletAddress: member.user.wallet_address,
  };
};

export const selectServerMemberWithUserId = (state) => (serverId, userId) => {
  const userServerMembers = state.serverMembers.memberIdsByUserId[userId].map(
    selectServerMember(state)
  );
  return userServerMembers.find((m) => m.server === serverId);
};

export const selectServerMembers = (state) => (serverId) => {
  const memberIds = state.serverMembers.memberIdsByServerId[serverId] ?? [];
  return memberIds.map(selectServerMember(state));
};

export const selectServerMembersByUserId = (state) => (serverId) => {
  const members = selectServerMembers(state)(serverId);
  return indexBy((m) => m.user.id, members);
};

export default combineReducers({
  entriesById,
  memberIdsByServerId,
  memberIdsByUserId,
});
