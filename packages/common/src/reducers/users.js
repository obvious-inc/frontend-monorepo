import { createSelector } from "reselect";
import { mapValues, omitKeys } from "../utils/object";
import { indexBy } from "../utils/array";
import combineReducers from "../utils/combine-reducers";
import { arrayShallowEquals } from "../utils/reselect";
import { build as buildProfilePicture } from "../utils/profile-pictures";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "fetch-channel-members-request-successful":
      return { ...state, ...indexBy((m) => m.id, action.members) };

    case "fetch-users-request-successful":
      return { ...state, ...indexBy((m) => m.id, action.users) };

    case "server-event:user-profile-updated":
      return mapValues((user) => {
        if (user.id !== action.data.user) return user;
        return {
          ...user,
          ...omitKeys(["user"], action.data),
        };
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

const selectAllUsers = (state) =>
  Object.keys(state.users.entriesById).map((userId) =>
    selectUser(state, userId)
  );

export const selectUser = createSelector(
  (state, userId) =>
    state.me.user?.id === userId
      ? { ...state.me.user, ...state.users.entriesById[userId] }
      : state.users.entriesById[userId],
  (state) => state.me.user,
  (user, loggedInUser) => {
    if (user == null) return null;
    const isLoggedInUser = user.id === loggedInUser?.id;
    return {
      ...user,
      displayName: user.display_name,
      walletAddress: user.wallet_address,
      onlineStatus: isLoggedInUser ? "online" : user.status,
      profilePicture: buildProfilePicture(user.pfp),
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

export default combineReducers({ entriesById });
