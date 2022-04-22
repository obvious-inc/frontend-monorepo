import React from "react";
import { mapValues } from "../utils/object";
import combineReducers from "../utils/combine-reducers";
import { useAuth } from "../auth";
import ui, { selectHasFetchedInitialData } from "../reducers/ui";
import servers, { selectServer, selectServers } from "../reducers/servers";
import channels, {
  selectChannel,
  selectServerChannels,
  selectServerDmChannels,
  selectDmChannels,
  selectDmChannelFromUserId,
  selectDmChannelFromUserIds,
  selectServerChannelTypingMembers,
} from "../reducers/channels";
import channelSections, {
  selectServerChannelSections,
  selectChannelSectionWithChild,
} from "../reducers/channel-sections";
import messages, {
  selectMessage,
  selectChannelMessages,
} from "../reducers/messages";
import serverMembers, {
  selectUser,
  selectUsers,
  selectUserFromWalletAddress,
  selectServerMember,
  selectServerMembers,
  selectServerMembersByUserId,
  selectServerMemberWithUserId,
  selectChannelMember,
  selectChannelMembers,
} from "../reducers/server-members";

const selectors = {
  selectUsers,
  selectUserFromWalletAddress,
  selectServerChannels,
  selectServerDmChannels,
  selectDmChannels,
  selectDmChannelFromUserId,
  selectDmChannelFromUserIds,
  selectServer,
  selectServers,
  selectServerMembersByUserId,
  selectHasFetchedInitialData,
  selectServerChannelSections,
  selectChannelSectionWithChild,
};

const memoizedSelectors = {
  selectUser,
  selectMessage,
  selectChannelMessages,
  selectServerMember,
  selectServerMemberWithUserId,
  selectChannel,
  selectServerChannelTypingMembers,
  selectServerMembers,
  selectChannelMember,
  selectChannelMembers,
};

const rootReducer = combineReducers({
  ui,
  servers,
  channels,
  channelSections,
  serverMembers,
  messages,
});

const initialState = rootReducer(undefined, {});

const applyStateToSelectors = (selectors, state) =>
  mapValues((selector) => selector(state), selectors);

const applyStateToMemoizedSelectors = (selectors, state) =>
  mapValues((selector) => selector.bind(null, state), selectors);

const useRootReducer = () => {
  const { user } = useAuth();

  const [state, dispatch_] = React.useReducer(rootReducer, initialState);

  const dispatch = React.useCallback(
    (...args) => {
      console.log(...args);
      return dispatch_(...args);
    },
    [dispatch_]
  );

  const appliedSelectors = applyStateToSelectors(selectors, { ...state, user });
  const appliedMemoizedSelectors = applyStateToMemoizedSelectors(
    memoizedSelectors,
    { ...state, user }
  );

  return [{ ...appliedSelectors, ...appliedMemoizedSelectors }, dispatch];
};

export default useRootReducer;
