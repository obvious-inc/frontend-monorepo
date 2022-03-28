import { mapValues, omitKeys } from "../utils/object";
import { indexBy, groupBy } from "../utils/array";
import combineReducers from "../utils/combine-reducers";

const userEntriesById = (state = {}, action) => {
  switch (action.type) {
    case "initial-data-request-successful": {
      const users = action.data.servers.flatMap((s) =>
        s.members.map((m) => m.user)
      );
      return indexBy((u) => u.id, users);
    }

    case "server-event:user-profile-updated":
      return mapValues((user) => {
        if (user.id !== action.data.user) return user;
        return {
          ...user,
          ...omitKeys(["user"], action.data),
        };
      }, state);

    case "server-event:user-presence-updated":
      return mapValues((user) => {
        if (user.id !== action.data.user.id) return user;
        return {
          ...user,
          status: action.data.user.status,
        };
      }, state);

    default:
      return state;
  }
};

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
            ...omitKeys(["user", "member"], action.data),
          },
        };
      }, state);

    case "server-event:user-presence-updated":
      return mapValues((member) => {
        if (member.user.id !== action.data.user.id) return member;
        return {
          ...member,
          user: {
            ...member.user,
            status: action.data.user.status,
          },
        };
      }, state);

    case "server-event:server-profile-updated":
      return {
        ...state,
        [action.data.member]: {
          ...state[action.data.member],
          ...omitKeys(["user", "member"], action.data),
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

const buildPfpUrl = (pfp) =>
  pfp?.cf_id && process.env.CLOUDFLARE_ACCT_HASH
    ? `https://imagedelivery.net/${process.env.CLOUDFLARE_ACCT_HASH}/${pfp.cf_id}/avatar`
    : pfp?.input_image_url;

export const selectUser = (state) => (id) => {
  const user = state.serverMembers.userEntriesById[id];
  const isLoggedInUser = user.id === state.user.id;
  return {
    ...user,
    pfpUrl: buildPfpUrl(user.pfp),
    displayName: user.display_name,
    walletAddress: user.wallet_address,
    onlineStatus: isLoggedInUser ? "online" : user.status,
  };
};

export const selectUserFromWalletAddress = (state) => (address) =>
  selectUsers(state)().find((u) => u.walletAddress === address);

export const selectUsers = (state) => () =>
  Object.keys(state.serverMembers.userEntriesById).map(selectUser(state));

export const selectServerMember = (state) => (id) => {
  const member = state.serverMembers.entriesById[id];

  const user = selectUser(state)(member.user.id);

  const displayName =
    member.display_name != null && member.display_name !== ""
      ? member.display_name
      : user.displayName;

  const pfp = member.pfp ?? user.pfp;
  const pfpUrl = buildPfpUrl(pfp);

  return {
    ...member,
    id: user.id, // Should be ok right?
    displayName,
    pfp,
    pfpUrl,
    walletAddress: user.wallet_address,
    onlineStatus: user.onlineStatus,
  };
};

export const selectServerMemberWithUserId = (state) => (serverId, userId) => {
  const userServerMembers = (
    state.serverMembers.memberIdsByUserId[userId] ?? []
  ).map(selectServerMember(state));
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
  userEntriesById,
  memberIdsByServerId,
  memberIdsByUserId,
});
