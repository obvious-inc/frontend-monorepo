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

export const selectServer = (state) => (id) => state.servers.entriesById[id];

export const selectServers = (state) => () =>
  Object.values(state.servers.entriesById);

export default reducer;
