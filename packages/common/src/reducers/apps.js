import { indexBy } from "../utils/array";
import combineReducers from "../utils/combine-reducers";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "fetch-client-boot-data-request-successful": {
      if (!action.apps) return state;
      return indexBy((a) => a.id, action.apps);
    }

    default:
      return state;
  }
};

export const selectApp = (state, appId) => state.apps.entriesById[appId];

export default combineReducers({ entriesById });
