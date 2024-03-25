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
    [dispatch_],
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
  const [authenticationData, setAuthenticationData] = React.useState(undefined);
  const [isConnected, setConnected] = React.useState(null);

  const user = useStore(selectMe);

  const authStatus =
    authenticationData === undefined
      ? "loading"
      : authenticationData != null
        ? "authenticated"
        : "not-authenticated";

  React.useEffect(() => {
    api.getAuthenticationData().then((authenticationData) => {
      setAuthenticationData(authenticationData);
    });
  }, [api]);

  const dispatch = useActionDispatcher();

  const cacheStore = useCacheStore();

  const selectors = mapValues(
    (selector) =>
      // eslint-disable-next-line
      useLatestCallback((...args) => selector(getStoreState(), ...args)),
    selectorFunctions,
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
      setAuthenticationData,
    }),
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
          actions.logout();
          setAuthenticationData(null);
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
    if (authenticationData == null || user?.id == null) return;

    let isConnected = false;
    let disconnect;

    const visibilityChangeHandler = () => {
      if (document.visibilityState !== "visible") return;
      if (isConnected) return;
      disconnect?.();
      connect();
    };

    const connect = async () => {
      const listener = (eventName, payload) => {
        if (eventName === "connection-state-change")
          isConnected = payload.connected;
      };
      const disconnect_ = await api.connect(
        { userId: user.id, authenticationData },
        listener,
      );
      disconnect = disconnect_;
      document.addEventListener("visibilitychange", visibilityChangeHandler);
    };

    connect();

    return () => {
      disconnect?.();
      document.removeEventListener("visibilitychange", visibilityChangeHandler);
    };
  }, [api, authenticationData, user?.id]);

  const contextValue = React.useMemo(
    () => ({
      isConnected,
      authStatus,
      selectors,
      actions,
    }),
    // eslint-disable-next-line
    [
      isConnected,
      authStatus,
      // eslint-disable-next-line
      ...Object.values(selectors),
      // eslint-disable-next-line
      ...Object.values(actions),
    ],
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
