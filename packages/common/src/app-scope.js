import React from "react";
import { useAuth } from "./auth";
import { generateDummyId } from "./utils/misc";
import { useServerConnection } from "./server-connection";
import useRootReducer from "./hooks/root-reducer";

const Context = React.createContext({});

export const useAppScope = () => React.useContext(Context);

export const Provider = ({ children }) => {
  const { user, authorizedFetch } = useAuth();
  const serverConnection = useServerConnection();
  const [stateSelectors, dispatch] = useRootReducer();

  const sendServerMessage = React.useCallback(
    (name, data) => {
      const messageSent = serverConnection.send(name, data);
      // Dispatch a client action if the message was successfully sent
      if (messageSent) dispatch({ type: name, data });
      return messageSent;
    },
    [dispatch, serverConnection]
  );

  const fetchUserData = React.useCallback(() => {
    sendServerMessage("request-user-data");
  }, [sendServerMessage]);

  const fetchMessages = React.useCallback(
    ({ channelId }) =>
      authorizedFetch(`/channels/${channelId}/messages`).then((messages) => {
        dispatch({ type: "messages-fetched", messages });
        return messages;
      }),
    [authorizedFetch, dispatch]
  );

  const createServer = React.useCallback(
    ({ name }) =>
      authorizedFetch("/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((res) => {
        // TODO
        fetchUserData();
        return res;
      }),
    [authorizedFetch, fetchUserData]
  );

  const markChannelRead = React.useCallback(
    ({ channelId, date = new Date() }) => {
      sendServerMessage("mark-channel-read", { channelId, date });
    },
    [sendServerMessage]
  );

  const createMessage = React.useCallback(
    async ({ server, channel, content }) => {
      // TODO: Less hacky optimistc UI
      const message = { server, channel, content };
      const dummyId = generateDummyId();

      dispatch({
        type: "message-create-request-sent",
        message: {
          ...message,
          id: dummyId,
          created_at: new Date().toISOString(),
          author: user.id,
        },
      });

      return authorizedFetch("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      }).then((message) => {
        dispatch({
          type: "message-create-request-successful",
          message,
          optimisticEntryId: dummyId,
        });
        markChannelRead({ channelId: channel });
        return message;
      });
    },
    [authorizedFetch, user, markChannelRead, dispatch]
  );

  const updateMessage = React.useCallback(
    async (messageId, { content }) => {
      return authorizedFetch(`/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }).then((message) => {
        dispatch({
          type: "message-update-request-successful",
          message,
        });
        return message;
      });
    },
    [authorizedFetch, dispatch]
  );

  const removeMessage = React.useCallback(
    async (messageId) => {
      return authorizedFetch(`/messages/${messageId}`, {
        method: "DELETE",
      }).then((message) => {
        dispatch({
          type: "message-delete-request-successful",
          messageId,
        });
        return message;
      });
    },
    [authorizedFetch, dispatch]
  );

  const createChannel = React.useCallback(
    ({ name, kind, server }) =>
      authorizedFetch("/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, server }),
      }).then((res) => {
        // TODO
        fetchUserData();
        return res;
      }),
    [authorizedFetch, fetchUserData]
  );

  const actions = React.useMemo(
    () => ({
      fetchUserData,
      fetchMessages,
      createServer,
      createChannel,
      createMessage,
      updateMessage,
      removeMessage,
      markChannelRead,
    }),
    [
      fetchUserData,
      fetchMessages,
      createServer,
      createChannel,
      createMessage,
      updateMessage,
      removeMessage,
      markChannelRead,
    ]
  );

  React.useEffect(() => {
    const handler = (name, data) => {
      dispatch({ type: ["server-event", name].join(":"), data, user });
    };

    const removeListener = serverConnection.addListener(handler);
    return () => {
      removeListener();
    };
  }, [user, serverConnection, dispatch]);

  const contextValue = React.useMemo(
    () => ({ state: stateSelectors, actions }),
    [stateSelectors, actions]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};
