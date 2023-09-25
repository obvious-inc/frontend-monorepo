import React from "react";
import { create as createZustandStoreHook } from "zustand";
import { useStore as useCacheStore } from "./cache-store.js";
import rootReducer from "./root-reducer.js";
import createActions from "./actions.js";
import { mapValues } from "./utils/object.js";
import { selectMe } from "./reducers/me.js";
import {
  selectUser,
  selectIsUserStarred,
  selectIsUserBlocked,
  selectUserFromWalletAddress,
} from "./reducers/users.js";
import {
  selectChannel,
  selectChannelName,
  selectChannelAccessLevel,
  selectStarredChannels,
  selectDmChannelFromUserId,
  selectDmChannelWithMember,
  selectChannelHasUnread,
} from "./reducers/channels.js";
import { selectMessage } from "./reducers/messages.js";
import { selectEnsName } from "./reducers/ens.js";
import { selectHasFetchedUserChannels } from "./reducers/ui.js";
import useLatestCallback from "./react/hooks/latest-callback.js";

const selectorFunctions = {
  selectMe,
  selectUser,
  selectUserFromWalletAddress,
  selectMessage,
  selectEnsName,
  selectDmChannelFromUserId,
  selectDmChannelWithMember,
  selectChannel,
  selectChannelName,
  selectStarredChannels,
  selectChannelAccessLevel,
  selectChannelHasUnread,
  selectIsUserStarred,
  selectIsUserBlocked,
  selectHasFetchedUserChannels,
};

const useZustandStore = createZustandStoreHook((setState) => {
  const initialState = rootReducer(undefined, {});
  return {
    ...initialState,
    dispatch: (action) => setState((state) => rootReducer(state, action)),
  };
});

export const useStore = (...args) => useZustandStore(...args);

const getStoreState = useZustandStore.getState;

const beforeActionListeners = new Set();
const afterActionListeners = new Set();

const useActionDispatcher = () => {
  const dispatch_ = useZustandStore((s) => s.dispatch);

  const dispatch = React.useCallback(
    (action) => {
      for (let listener of beforeActionListeners) listener(action);
      const result = dispatch_(action);
      for (let listener of afterActionListeners) listener(action);
      return result;
    },
    [dispatch_]
  );

  return dispatch;
};

export const useBeforeActionListener = (listener_) => {
  const listener = useLatestCallback(listener_);

  React.useEffect(() => {
    beforeActionListeners.add(listener);
    return () => {
      beforeActionListeners.delete(listener);
    };
  }, [listener]);
};

export const useAfterActionListener = (listener_) => {
  const listener = useLatestCallback(listener_);

  React.useEffect(() => {
    afterActionListeners.add(listener);
    return () => {
      afterActionListeners.delete(listener);
    };
  }, [listener]);
};

const Context = React.createContext({});

export const Provider = ({ api, children }) => {
  const [isAuthenticated, setAuthenticated] = React.useState(null);
  const [isConnected, setConnected] = React.useState(null);

  const user = useStore(selectMe);

  const authStatus =
    isAuthenticated == null
      ? "loading"
      : isAuthenticated
      ? "authenticated"
      : "not-authenticated";

  React.useEffect(() => {
    api.isAuthenticated().then((isAuthenticated) => {
      setAuthenticated(isAuthenticated);
    });
  }, [api]);

  const dispatch = useActionDispatcher();

  const cacheStore = useCacheStore();

  const { parseUser, parseChannel, parseMessage } = api.parsers;

  const selectors = mapValues(
    (selector) =>
      // eslint-disable-next-line
      useLatestCallback((...args) => selector(getStoreState(), ...args)),
    selectorFunctions
  );

  const actions = mapValues(
    // eslint-disable-next-line
    (actionFn) => useLatestCallback(actionFn),
    createActions({
      api,
      dispatch,
      authStatus,
      getStoreState,
      cacheStore,
      setAuthenticated,
    })
  );

  React.useEffect(() => {
    let typingEndedTimeoutHandles = {};

    const removeListener = api.addListener((eventName, payload) => {
      const me = selectMe(getStoreState());

      // Dispatch a 'user-typing-ended' action when a user+channel combo has
      // been silent for a while
      if (eventName === "server-event:user-typed") {
        const id = [payload.channelId, payload.userId].join(":");

        if (typingEndedTimeoutHandles[id]) {
          clearTimeout(typingEndedTimeoutHandles[id]);
          delete typingEndedTimeoutHandles[id];
        }

        typingEndedTimeoutHandles[id] = setTimeout(() => {
          delete typingEndedTimeoutHandles[id];
          dispatch({
            type: "user-typing-ended",
            channelId: payload.channelId,
            userId: payload.userId,
          });
        }, 6000);
      }

      switch (eventName) {
        case "user-authentication-expired":
          actions();
          setAuthenticated(false);
          break;

        case "connection-state-change":
          setConnected(payload.connected === true);
          break;

        // Regular server event
        default:
          dispatch({ type: eventName, data: payload, user: me });
      }
    });

    return () => {
      removeListener();
    };
  }, [api, actions, dispatch]);

  React.useEffect(() => {
    if (!isAuthenticated || user?.id == null) return;
    api.connect({ userId: user.id });
  }, [isAuthenticated, user?.id, api]);

  const serverMessageHandler = useLatestCallback((name, data) => {
    const me = selectMe(getStoreState());

    let typingEndedTimeoutHandles = {};

    // Dispatch a 'user-typing-ended' action when a user+channel combo has
    // been silent for a while
    if (name === "user-typed") {
      const id = [data.channel.id, data.user.id].join(":");

      if (typingEndedTimeoutHandles[id]) {
        clearTimeout(typingEndedTimeoutHandles[id]);
        delete typingEndedTimeoutHandles[id];
      }

      typingEndedTimeoutHandles[id] = setTimeout(() => {
        delete typingEndedTimeoutHandles[id];
        dispatch({
          type: "user-typing-ended",
          channelId: data.channel.id,
          userId: data.user.id,
        });
      }, 6000);
    }

    const dispatchEvent = (customData) =>
      dispatch({
        type: ["server-event", name].join(":"),
        data: { ...data, ...customData },
        user: me,
      });

    switch (name) {
      case "channel-updated":
      case "channel-user":
        dispatchEvent({ channel: parseChannel(data.channel) });
        break;

      case "user-profile-updated":
      case "user-presence-updated":
      case "channel-user-joined":
        dispatchEvent({ user: parseUser(data.user) });
        break;

      case "message-created":
      case "message-updated":
      case "message-removed":
      case "message-reaction-added":
      case "message-reaction-removed":
        dispatchEvent({ message: parseMessage(data.message) });
        break;

      case "channel-user-invited":
        dispatchEvent({
          user: parseUser(data.user),
          channel: parseChannel(data.channel),
        });
        break;

      default:
        dispatchEvent();
    }
  });

  const contextValue = React.useMemo(
    () => ({
      isConnected,
      authStatus,
      selectors,
      actions,
      serverMessageHandler,
    }),
    // eslint-disable-next-line
    [
      isConnected,
      authStatus,
      // eslint-disable-next-line
      ...Object.values(selectors),
      // eslint-disable-next-line
      ...Object.values(actions),
      serverMessageHandler,
    ]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export const useAuth = () => {
  const { authStatus } = React.useContext(Context);
  return { status: authStatus };
};

export const useSelectors = () => {
  const { selectors } = React.useContext(Context);
  return selectors;
};

export const useActions = () => {
  const { actions } = React.useContext(Context);
  return actions;
};

export const useServerConnectionState = () => {
  const { isConnected } = React.useContext(Context);
  return { isConnected };
};
