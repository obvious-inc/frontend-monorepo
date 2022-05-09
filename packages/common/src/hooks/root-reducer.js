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
  selectHasAllMessages,
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

  const afterEffectHooksRef = React.useRef([]);

  const addAfterEffectHook = React.useCallback((fn) => {
    afterEffectHooksRef.current.push(fn);

    return () => {
      afterEffectHooksRef.current.filter((fn_) => fn_ !== fn);
    };
  }, []);

  const dispatch = React.useCallback((action) => {
    const result = dispatch_(action);
    for (let callback of afterEffectHooksRef.current) callback(action);
    return result;
  }, []);

  const appliedSelectors = React.useMemo(
    () => applyStateToSelectors(selectors, { ...state, user }),
    [state, user]
  );

  return [appliedSelectors, dispatch, { addAfterEffectHook }];
};

export default useRootReducer;
