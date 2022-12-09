import React from "react";
import { mapValues } from "../utils/object";
import combineReducers from "../utils/combine-reducers";
import me, { selectMe, selectChannelNotificationSetting } from "../reducers/me";
import ui, {
  selectHasFetchedInitialData,
  selectHasFetchedMenuData,
} from "../reducers/ui";
import channels, {
  selectChannel,
  selectChannelName,
  selectMemberChannels,
  selectDmChannels,
  selectStarredChannels,
  selectPublicChannels,
  selectDmChannelFromUserId,
  selectDmChannelFromUserIds,
  selectHasAllMessages,
  selectHasFetchedMessages,
  selectChannelHasUnread,
  selectChannelMentionCount,
  selectTotalMentionCount,
  selectChannelStarId,
  selectIsChannelStarred,
  selectChannelMembers,
  selectChannelAccessLevel,
  selectChannelHasOpenReadAccess,
  selectCanAddChannelMember,
  selectCanManageChannelInfo,
  selectChannelLastMessageAt,
  selectAllChannels,
} from "../reducers/channels";
import messages, {
  selectMessage,
  selectChannelMessages,
} from "../reducers/messages";
import users, {
  selectUser,
  selectUsers,
  selectStarredUserIds,
  selectStarredUsers,
  selectUserFromWalletAddress,
  selectIsUserStarred,
  selectUserStarId,
  selectIsUserBlocked,
} from "../reducers/users";
import channelTypingStatus, {
  selectChannelTypingMembers,
} from "../reducers/channel-typing-status";
import apps, { selectApp } from "../reducers/apps";
import ens, { selectEnsName, selectEnsAvatar } from "../reducers/ens";

const selectors = {
  selectMe,
  selectChannelNotificationSetting,
  selectChannel,
  selectChannelName,
  selectChannelMembers,
  selectChannelAccessLevel,
  selectMemberChannels,
  selectDmChannels,
  selectStarredChannels,
  selectPublicChannels,
  selectMessage,
  selectChannelMessages,
  selectUser,
  selectUsers,
  selectStarredUserIds,
  selectStarredUsers,
  selectUserFromWalletAddress,
  selectDmChannelFromUserId,
  selectDmChannelFromUserIds,
  selectHasFetchedInitialData,
  selectChannelTypingMembers,
  selectHasAllMessages,
  selectHasFetchedMessages,
  selectChannelHasUnread,
  selectChannelMentionCount,
  selectTotalMentionCount,
  selectChannelStarId,
  selectUserStarId,
  selectIsChannelStarred,
  selectIsUserStarred,
  selectApp,
  selectEnsName,
  selectEnsAvatar,
  selectHasFetchedMenuData,
  selectChannelHasOpenReadAccess,
  selectCanAddChannelMember,
  selectCanManageChannelInfo,
  selectIsUserBlocked,
  selectChannelLastMessageAt,
  selectAllChannels,
};

const rootReducer = combineReducers({
  me,
  channels,
  users,
  messages,
  channelTypingStatus,
  apps,
  ens,
  ui,
});

const initialState = rootReducer(undefined, {});

const applyStateToSelectors = (selectors, state) =>
  mapValues((selector) => selector.bind(null, state), selectors);

const useRootReducer = () => {
  const [state, dispatch_] = React.useReducer(rootReducer, initialState);

  const beforeDispatchListenersRef = React.useRef([]);
  const afterDispatchListenersRef = React.useRef([]);

  const addBeforeDispatchListener = React.useCallback((fn) => {
    beforeDispatchListenersRef.current.push(fn);

    return () => {
      beforeDispatchListenersRef.current =
        beforeDispatchListenersRef.current.filter((fn_) => fn_ !== fn);
    };
  }, []);

  const addAfterDispatchListener = React.useCallback((fn) => {
    afterDispatchListenersRef.current.push(fn);

    return () => {
      afterDispatchListenersRef.current =
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
    () => applyStateToSelectors(selectors, state),
    [state]
  );

  return [
    appliedSelectors,
    dispatch,
    { addBeforeDispatchListener, addAfterDispatchListener },
  ];
};

export default useRootReducer;
