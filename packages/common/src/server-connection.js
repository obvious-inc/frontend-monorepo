import React from "react";
import { useAuth } from "./auth";
import { useAppScope } from "./app-scope";

const serverEventMap = {
  MESSAGE_CREATE: "message-created",
  MESSAGE_UPDATE: "message-updated",
  MESSAGE_REMOVE: "message-removed",
  MESSAGE_REACTION_ADD: "message-reaction-added",
  MESSAGE_REACTION_REMOVE: "message-reaction-removed",
  USER_PROFILE_UPDATE: "user-profile-updated",
  USER_PRESENCE_UPDATE: "user-presence-updated",
  USER_TYPING: "user-typed",
  CHANNEL_UPDATE: "channel-updated",
  CHANNEL_USER_JOINED: "channel-member-joined",
};

const initPusherConnection = ({ Pusher, key, accessToken, apiOrigin }) => {
  const pusher = new Pusher(key, {
    cluster: "eu",
    authEndpoint: `${apiOrigin}/websockets/auth`,
    auth: {
      params: { provider: "pusher" },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  return new Promise((resolve) => {
    pusher.connection.bind("connected", () => {
      resolve(pusher);
    });
  });
};

const Context = React.createContext(null);

export const Provider = ({ Pusher, pusherKey, debug = false, children }) => {
  const { state } = useAppScope();
  const { accessToken, apiOrigin } = useAuth();

  const user = state.selectMe();

  const pusherRef = React.useRef();
  const channelRef = React.useRef();
  const listenersRef = React.useRef([]);

  const [pusherState, setPusherState] = React.useState(null);

  const addListener = React.useCallback((fn) => {
    listenersRef.current = [...listenersRef.current, fn];
    return () => {
      listenersRef.current = listenersRef.current.filter((fn_) => fn !== fn_);
    };
  }, []);

  React.useEffect(() => {
    if (accessToken == null || user?.id == null) return;
    Pusher.logToConsole = debug;

    const connect = async () => {
      const pusher = await initPusherConnection({
        Pusher,
        key: pusherKey,
        accessToken,
        apiOrigin,
      });

      if (pusherRef.current != null) {
        pusherRef.current.connection.unbind("state_change");
        pusherRef.current.disconnect();
      }

      pusherRef.current = pusher;
      channelRef.current = pusher.subscribe(`private-${user.id}`);

      for (let event of Object.keys(serverEventMap))
        channelRef.current.bind(event, (data) => {
          const clientEventName = serverEventMap[event];
          listenersRef.current.forEach((fn) => fn(clientEventName, data));
        });

      pusher.connection.bind("state_change", ({ current }) => {
        setPusherState(current);
      });

      setPusherState(pusher.connection.state);
    };

    connect();
  }, [Pusher, apiOrigin, pusherKey, debug, user?.id, accessToken]);

  const serverConnection = React.useMemo(
    () => ({ addListener, isConnected: pusherState === "connected" }),
    [addListener, pusherState]
  );

  return (
    <Context.Provider value={serverConnection}>{children}</Context.Provider>
  );
};

export const useServerConnection = () => React.useContext(Context);
