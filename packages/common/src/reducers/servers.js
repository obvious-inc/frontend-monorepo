import { indexBy } from "../utils/array";

const initialState = {
  entriesById: {},
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case "initial-data-request-successful":
      return {
        ...state,
        entriesById: indexBy((s) => s.id, action.data.servers),
      };
    default:
      return state;
  }
};

export const selectServer = (state) => (id) => {
  const server = state.servers.entriesById[id];
  if (server == null) return null;
  return { ...server, ownerUserId: server.owner };
};

export const selectServers = (state) => () =>
  Object.values(state.servers.entriesById);

export default reducer;
