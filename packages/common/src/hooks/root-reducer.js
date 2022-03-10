import React from "react";
import { mapValues } from "../utils/object";
import combineReducers from "../utils/combine-reducers";
import { useAuth } from "../auth";
import ui, { selectHasFetchedInitialData } from "../reducers/ui";
import servers, { selectServer, selectServers } from "../reducers/servers";
import channels, { selectServerChannels } from "../reducers/channels";
import messages, { selectChannelMessages } from "../reducers/messages";
import serverMembers, {
  selectServerMembers,
  selectServerMembersByUserId,
} from "../reducers/server-members";

const selectors = {
  selectServerChannels,
  selectChannelMessages,
  selectServer,
  selectServers,
  selectServerMembers,
  selectServerMembersByUserId,
  selectHasFetchedInitialData,
};

const rootReducer = combineReducers({
  ui,
  servers,
  channels,
  serverMembers,
  messages,
});

const initialState = rootReducer(undefined, {});

const applyStateToSelectors = (selectors, state) =>
  mapValues((selector) => selector(state), selectors);

const useRootReducer = () => {
  const { user } = useAuth();

  const [state, dispatch] = React.useReducer(rootReducer, initialState);

  const appliedSelectors = applyStateToSelectors(selectors, { ...state, user });

  return [appliedSelectors, dispatch];
};

export default useRootReducer;
