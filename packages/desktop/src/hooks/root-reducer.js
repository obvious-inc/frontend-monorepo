import React from "react";
import { mapValues } from "../utils/object";
import combineReducers from "../utils/combine-reducers";
import servers, { selectServer } from "../reducers/servers";
import messages, { selectChannelMessages } from "../reducers/messages";
import serverMembers, {
  selectServerMembersByUserId,
} from "../reducers/server-members";

const selectors = {
  selectChannelMessages,
  selectServer,
  selectServerMembersByUserId,
};

const globalReducer = combineReducers({ servers, serverMembers, messages });
const initialState = globalReducer(undefined, {});

const applyStateToSelectors = (selectors, state) =>
  mapValues((selector) => selector(state), selectors);

const useGlobalState = () => {
  const [state, dispatch] = React.useReducer(globalReducer, initialState);

  const appliedSelectors = applyStateToSelectors(selectors, state);

  return [appliedSelectors, dispatch];
};

export default useGlobalState;
