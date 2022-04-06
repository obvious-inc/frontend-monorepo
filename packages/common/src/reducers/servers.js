import { indexBy } from "../utils/array";
import { selectServerChannels } from "../reducers/channels";

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
  const ownerUserId = server.owner;
  return {
    ...server,
    ownerUserId,
    isAdmin: state.user.id === ownerUserId,
    channels: selectServerChannels(state)(id),
  };
};

export const selectServers = (state) => () =>
  Object.keys(state.servers.entriesById).map(selectServer(state));

export default reducer;
