import { createSelector } from "reselect";
import combineReducers from "../utils/combine-reducers";
import { indexBy } from "../utils/array";
import { arrayShallowEquals } from "../utils/reselect";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "initial-data-request-successful": {
      const mergedServers = action.data.servers.map((s) => {
        const existingServer = state[s.id];
        if (existingServer == null) return s;
        return { ...existingServer, ...s };
      });
      const serversById = indexBy((s) => s.id, mergedServers);
      return { ...state, ...serversById };
    }

    case "fetch-servers-request-successful": {
      const mergedServers = action.servers.map((s) => {
        const existingEntry = state[s.id];
        return { ...existingEntry, ...s };
      });
      const mergedServersById = indexBy((s) => s.id, mergedServers);
      return {
        ...state,
        ...mergedServersById,
      };
    }

    case "fetch-server-request-successful": {
      const existingEntry = state[action.server.id];
      return {
        ...state,
        [action.server.id]: { ...existingEntry, ...action.server },
      };
    }

    case "logout":
      return {};

    default:
      return state;
  }
};

export const selectServer = createSelector(
  (state, id) => state.servers.entriesById[id],
  (state) => state.user?.id,
  (server, loggedInUserId) => {
    if (server == null) return null;
    const ownerUserId = server.owner;
    const members = server.members ?? [];
    return {
      ...server,
      avatar: server.avatar === "" ? null : server.avatar ?? null,
      memberCount: server.member_count,
      members,
      ownerUserId,
      isMember:
        loggedInUserId != null &&
        members.some((m) => m.user === loggedInUserId),
      isAdmin: loggedInUserId != null && loggedInUserId === ownerUserId,
    };
  }
);

export const selectServers = createSelector(
  (state) =>
    Object.keys(state.servers.entriesById).map((id) => selectServer(state, id)),
  (servers) => servers,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export const selectJoinedServers = createSelector(selectServers, (servers) =>
  servers.filter((s) => s.isMember)
);

export default combineReducers({ entriesById });
