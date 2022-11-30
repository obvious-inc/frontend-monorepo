import { createSelector } from "reselect";
import { mapValues, omitKey } from "../utils/object";
import { indexBy } from "../utils/array";
import combineReducers from "../utils/combine-reducers";
import { arrayShallowEquals } from "../utils/reselect";
import { truncateAddress } from "../utils/ethereum";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "fetch-channel-members-request-successful":
    case "fetch-users-request-successful": {
      const users = action.members ?? action.users;
      const mergedUsers = users.map((u) => {
        const existingUser = state[u.id];
        return { ...existingUser, ...u };
      });
      const usersById = indexBy((m) => m.id, mergedUsers);
      return { ...state, ...usersById };
    }

    case "fetch-me-request-successful":
    case "update-me:request-successful":
    case "fetch-client-boot-data-request-successful": {
      const exisingUser = state[action.user.id];
      return { ...state, [action.user.id]: { ...exisingUser, ...action.user } };
    }

    case "server-event:user-profile-updated":
      return mapValues((user) => {
        if (user.id !== action.data.user.id) return user;
        return { ...user, ...action.data.user };
      }, state);

    case "server-event:channel-user-joined":
    case "server-event:channel-user-invited":
      return {
        ...state,
        [action.data.user.id]: action.data.user,
      };

    case "server-event:user-presence-updated":
      return mapValues((user) => {
        if (user.id !== action.data.user.id) return user;
        return {
          ...user,
          status: action.data.user.status,
        };
      }, state);

    case "logout":
      return {};

    default:
      return state;
  }
};

const blockedUserIds = (state = [], action) => {
  switch (action.type) {
    case "fetch-blocked-users:request-successful":
      return action.userIds;

    case "logout":
      return [];

    default:
      return state;
  }
};

const starsByUserId = (state = {}, action) => {
  switch (action.type) {
    case "fetch-starred-items:request-successful": {
      const userStars = action.stars.filter((s) => s.type === "user");
      return indexBy((s) => s.reference, userStars);
    }

    case "star-user:request-successful":
      return { ...state, [action.userId]: action.star };

    case "unstar-user:request-successful":
      return omitKey(action.userId, state);

    case "logout":
      return {};

    default:
      return state;
  }
};

const selectAllUsers = (state) =>
  Object.keys(state.users.entriesById).map((userId) =>
    selectUser(state, userId)
  );

export const selectUser = createSelector(
  (state, userId) => state.users.entriesById[userId],
  (state, userId) => {
    const user = state.users.entriesById[userId];
    if (user == null || user.deleted) return null;
    return state.ens.namesByAddress[user.walletAddress.toLowerCase()];
  },
  (state) => state.me.user?.id,
  (user, ensName, loggedInUserId) => {
    if (user == null) return null;
    if (user.deleted) return user;

    const isLoggedInUser = user.id === loggedInUserId;

    const hasCustomDisplayName =
      (user.displayName ?? "") !== "" &&
      truncateAddress(user.walletAddress) !== user.displayName;

    return {
      ...user,
      ensName,
      displayName: user.displayName ?? truncateAddress(user.walletAddress),
      description: user.description,
      customDisplayName: hasCustomDisplayName ? user.displayName : null,
      hasCustomDisplayName,
      onlineStatus: isLoggedInUser ? "online" : user.status,
      profilePicture: user.profilePicture ?? { large: null, small: null },
    };
  },
  { memoizeOptions: { maxSize: 1000 } }
);

export const selectUsers = createSelector(
  (state, userIds) =>
    userIds.map((userId) => selectUser(state, userId)).filter(Boolean),
  (users) => users,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectUserFromWalletAddress = (state, address) =>
  selectAllUsers(state).find(
    (u) => u.walletAddress.toLowerCase() === address.toLowerCase()
  );

export const selectStarredUserIds = createSelector(
  (state) => Object.keys(state.users.starsByUserId),
  (userIds) => userIds,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectStarredUsers = createSelector(
  (state) =>
    selectStarredUserIds(state)
      .map((id) => selectUser(state, id))
      .filter(Boolean),
  (users) => users,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectIsUserStarred = (state, id) =>
  selectUserStarId(state, id) != null;

export const selectUserStarId = (state, userId) =>
  state.users.starsByUserId[userId]?.id;

export const selectIsUserBlocked = (state, userId) =>
  state.users.blockedUserIds.includes(userId);

export default combineReducers({ entriesById, starsByUserId, blockedUserIds });
