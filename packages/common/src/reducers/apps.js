import { createSelector } from "reselect";
import { indexBy } from "../utils/array";
import combineReducers from "../utils/combine-reducers";
import { arrayShallowEquals } from "../utils/reselect";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "initial-data-request-successful": {
      if (!action.data.apps) return state;
      return indexBy((a) => a.id, action.data.apps);
    }

    default:
      return state;
  }
};

export const selectApp = (state, appId) => state.apps?.entriesById[appId];

export default combineReducers({ entriesById });
