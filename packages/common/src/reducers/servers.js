import { createSelector } from "reselect";
import combineReducers from "../utils/combine-reducers";
import { indexBy } from "../utils/array";
import { arrayShallowEquals } from "../utils/reselect";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "initial-data-request-successful":
      return indexBy((s) => s.id, action.data.servers);
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
    return {
      ...server,
      ownerUserId,
      isAdmin: loggedInUserId === ownerUserId,
    };
  }
);

export const selectServers = createSelector(
  (state) =>
    Object.keys(state.servers.entriesById).map((id) => selectServer(state, id)),
  (servers) => servers,
  { memoizeOptions: { equalityCheck: arrayShallowEquals } }
);

export default combineReducers({ entriesById });
