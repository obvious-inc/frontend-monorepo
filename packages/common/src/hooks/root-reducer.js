import React from "react";
import { mapValues } from "../utils/object";
import combineReducers from "../utils/combine-reducers";
import { useAuth } from "../auth";
import ui, { selectHasFetchedInitialData } from "../reducers/ui";
import servers, {
  selectServer,
  selectServers,
  selectJoinedServers,
} from "../reducers/servers";
import channels, {
  selectChannel,
  selectServerChannels,
  selectServerDmChannels,
  selectDmChannels,
  selectDmChannelFromUserId,
  selectDmChannelFromUserIds,
  selectHasAllMessages,
  selectHasFetchedMessages,
  selectChannelHasUnread,
  selectChannelMentionCount,
} from "../reducers/channels";
import channelSections, {
  selectServerChannelSections,
  selectChannelSectionWithChild,
} from "../reducers/channel-sections";
import messages, {
  selectMessage,
  selectChannelMessages,
} from "../reducers/messages";
import users, {
  selectUser,
  selectUserFromWalletAddress,
} from "../reducers/users";
import serverMembers, {
  selectServerMembers,
  selectServerMemberWithUserId,
  selectChannelMember,
  selectChannelMembers,
} from "../reducers/server-members";
import channelTypingStatus, {
  selectChannelTypingMembers,
} from "../reducers/channel-typing-status";

const selectors = {
  selectServer,
  selectServers,
  selectJoinedServers,
  selectChannel,
  selectServerChannels,
  selectDmChannels,
  selectServerDmChannels,
  selectMessage,
  selectChannelMessages,
  selectUser,
  selectUserFromWalletAddress,
  selectServerMembers,
  selectServerMemberWithUserId,
  selectChannelMember,
  selectChannelMembers,
  selectDmChannelFromUserId,
  selectDmChannelFromUserIds,
  selectHasFetchedInitialData,
  selectServerChannelSections,
  selectChannelSectionWithChild,
  selectChannelTypingMembers,
  selectHasAllMessages,
  selectHasFetchedMessages,
  selectChannelHasUnread,
  selectChannelMentionCount,
};

const rootReducer = combineReducers({
  ui,
  servers,
  channels,
  channelSections,
  users,
  serverMembers,
  messages,
  channelTypingStatus,
});

const initialState = rootReducer(undefined, {});

const applyStateToSelectors = (selectors, state) =>
  mapValues((selector) => selector.bind(null, state), selectors);

const useRootReducer = () => {
  const { user } = useAuth();

  const [state, dispatch_] = React.useReducer(rootReducer, initialState);

  const beforeDispatchListenersRef = React.useRef([]);
  const afterDispatchListenersRef = React.useRef([]);

  const addBeforeDispatchListener = React.useCallback((fn) => {
    beforeDispatchListenersRef.current.push(fn);

    return () => {
      beforeDispatchListenersRef.current.filter((fn_) => fn_ !== fn);
    };
  }, []);

  const addAfterDispatchListener = React.useCallback((fn) => {
    afterDispatchListenersRef.current.push(fn);

    return () => {
      afterDispatchListenersRef.current.filter((fn_) => fn_ !== fn);
    };
  }, []);

  const dispatch = React.useCallback((action) => {
    for (let callback of beforeDispatchListenersRef.current) callback(action);
    const result = dispatch_(action);
    for (let callback of afterDispatchListenersRef.current) callback(action);
    return result;
  }, []);

  const appliedSelectors = React.useMemo(
    () => applyStateToSelectors(selectors, { ...state, user }),
    [state, user]
  );

  return [
    appliedSelectors,
    dispatch,
    { addBeforeDispatchListener, addAfterDispatchListener },
  ];
};

export default useRootReducer;
