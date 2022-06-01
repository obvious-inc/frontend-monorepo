import { createSelector } from "reselect";
import { indexBy } from "../utils/array";
import combineReducers from "../utils/combine-reducers";
import { arrayShallowEquals } from "../utils/reselect";

const entriesById = (state = {}, action) => {
  switch (action.type) {
    case "initial-data-request-successful": {
      return indexBy((a) => a.id, action.data.apps);
    }

    default:
      return state;
  }
};

export const selectApp = createSelector(
  (state, appId) => state.apps.entriesById[appId],
  (app) => app,
  { memoizeOptions: { maxSize: 1000 } }
);

export default combineReducers({ entriesById });
