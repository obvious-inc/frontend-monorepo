import React from "react";
import { useAuth } from "./auth";
import { generateDummyId } from "./utils/misc";
import invariant from "./utils/invariant";
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
      if (!serverConnection.isConnected)
        throw new Error("Not connected to server");

      const messageSent = serverConnection.send(name, data);
      // Dispatch a client action if the message was successfully sent
      if (messageSent) dispatch({ type: name, data });
      return messageSent;
    },
    [dispatch, serverConnection]
  );

  const fetchInitialData = React.useCallback(
    () =>
      authorizedFetch("/ready").then((data) => {
        dispatch({ type: "initial-data-request-successful", data });
        return data;
      }),
    [authorizedFetch, dispatch]
  );

  const updateMe = React.useCallback(
    ({ displayName, pfp, serverId }) => {
      const searchParams = serverId == null ? null : `server_id=${serverId}`;
      return authorizedFetch(
        ["/users/me", searchParams].filter(Boolean).join("?"),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: displayName,
            pfp,
          }),
        }
      );
    },
    [authorizedFetch]
  );

  const fetchMessages = React.useCallback(
    ({ channelId }) =>
      authorizedFetch(`/channels/${channelId}/messages`).then((messages) => {
        dispatch({ type: "messages-fetched", messages });

        const replies = messages.filter((m) => m.reply_to != null);

        // Fetch all messages replied to async. Works for now!
        for (let reply of replies)
          authorizedFetch(
            `/channels/${channelId}/messages/${reply.reply_to}`
          ).then((message) => {
            dispatch({ type: "messages-fetched", messages: [message] });
          });

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
        fetchInitialData();
        return res;
      }),
    [authorizedFetch, fetchInitialData]
  );

  const markChannelRead = React.useCallback(
    ({ channelId, date = new Date() }) => {
      sendServerMessage("mark-channel-read", { channelId, date });
    },
    [sendServerMessage]
  );

  const fetchMessage = React.useCallback(
    (id) =>
      authorizedFetch(`/messages/${id}`).then((message) => {
        dispatch({
          type: "message-fetch-request-successful",
          message,
        });
        return message;
      }),
    [authorizedFetch, dispatch]
  );

  const createMessage = React.useCallback(
    async ({ server, channel, content, blocks, replyToMessageId }) => {
      // TODO: Less hacky optimistc UI
      const message = {
        server,
        channel,
        blocks,
        content,
        reply_to: replyToMessageId,
      };
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
    async (messageId, { blocks, content }) => {
      return authorizedFetch(`/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, content }),
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

  const addMessageReaction = React.useCallback(
    async (messageId, { emoji }) => {
      invariant(
        // https://stackoverflow.com/questions/18862256/how-to-detect-emoji-using-javascript#answer-64007175
        /\p{Emoji}/u.test(emoji),
        "Only emojis allowed"
      );

      dispatch({
        type: "add-message-reaction:request-sent",
        messageId,
        emoji,
        userId: user.id,
      });

      // TODO: Undo the optimistic update if the request fails
      return authorizedFetch(
        `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        { method: "POST" }
      );
    },
    [authorizedFetch, dispatch, user?.id]
  );

  const removeMessageReaction = React.useCallback(
    async (messageId, { emoji }) => {
      dispatch({
        type: "remove-message-reaction:request-sent",
        messageId,
        emoji,
        userId: user.id,
      });

      // TODO: Undo the optimistic update if the request fails
      return authorizedFetch(
        `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        { method: "DELETE" }
      );
    },
    [authorizedFetch, dispatch, user?.id]
  );

  const createChannel = React.useCallback(
    ({ name, kind, server }) =>
      authorizedFetch("/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, server }),
      }).then((res) => {
        // TODO
        fetchInitialData();
        return res;
      }),
    [authorizedFetch, fetchInitialData]
  );

  const uploadImage = React.useCallback(
    ({ files }) => {
      const formData = new FormData();
      for (let file of files) formData.append("files", file);
      return authorizedFetch("/media/images", {
        method: "POST",
        body: formData,
      });
    },
    [authorizedFetch]
  );

  const actions = React.useMemo(
    () => ({
      fetchInitialData,
      fetchMessage,
      updateMe,
      fetchMessages,
      createServer,
      createChannel,
      createMessage,
      updateMessage,
      removeMessage,
      addMessageReaction,
      removeMessageReaction,
      markChannelRead,
      uploadImage,
    }),
    [
      fetchInitialData,
      fetchMessage,
      updateMe,
      fetchMessages,
      createServer,
      createChannel,
      createMessage,
      updateMessage,
      removeMessage,
      addMessageReaction,
      removeMessageReaction,
      markChannelRead,
      uploadImage,
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
    () => ({ serverConnection, state: stateSelectors, actions }),
    [stateSelectors, actions, serverConnection]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};
