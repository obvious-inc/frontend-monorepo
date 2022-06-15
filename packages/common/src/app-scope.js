import React from "react";
import { arrayUtils } from "@shades/common";
import { useAuth } from "./auth";
import { generateDummyId } from "./utils/misc";
import invariant from "./utils/invariant";
import { useServerConnection } from "./server-connection";
import useRootReducer from "./hooks/root-reducer";
import useLatestCallback from "./hooks/latest-callback";

const { unique } = arrayUtils;

const Context = React.createContext({});

export const useAppScope = () => React.useContext(Context);

export const Provider = ({ children }) => {
  const {
    user,
    authorizedFetch,
    apiOrigin,
    logout: clearAuthTokens,
  } = useAuth();
  const serverConnection = useServerConnection();
  const [
    stateSelectors,
    dispatch,
    { addBeforeDispatchListener, addAfterDispatchListener },
  ] = useRootReducer();

  const logout = useLatestCallback(() => {
    clearAuthTokens();
    dispatch({ type: "logout" });
  });

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

  const fetchServers = React.useCallback(async () => {
    const servers = await authorizedFetch("/servers");
    dispatch({ type: "fetch-servers-request-successful", servers });
    return servers;
  }, [dispatch, authorizedFetch]);

  const fetchPublicServerData = useLatestCallback(async (id) => {
    const response = await fetch(`${apiOrigin}/servers/${id}`);
    if (!response.ok) {
      const error = new Error(
        response.status === 400 ? "not-found" : response.statusText
      );
      return Promise.reject(error);
    }

    const server = await response.json();
    dispatch({ type: "fetch-server-request-successful", server });
    return server;
  });

  const joinServer = React.useCallback(
    (id) =>
      authorizedFetch(`/servers/${id}/join`, { method: "POST" }).then((res) => {
        // TODO
        fetchInitialData();
        return res;
      }),
    [authorizedFetch, fetchInitialData]
  );

  const updateServer = React.useCallback(
    (id, { name, description, avatar, system_channel }) =>
      authorizedFetch(`/servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          avatar,
          system_channel,
        }),
      }).then((res) => {
        // TODO
        fetchInitialData();
        return res;
      }),
    [authorizedFetch, fetchInitialData]
  );

  const createServerChannelSection = React.useCallback(
    (serverId, { name }) =>
      authorizedFetch(`/servers/${serverId}/sections`, {
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

  const updateServerChannelSections = React.useCallback(
    (serverId, sections) =>
      authorizedFetch(`/servers/${serverId}/sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sections.map((s) => ({ ...s, channels: s.channelIds }))
        ),
      }).then((res) => {
        // TODO
        fetchInitialData();
        return res;
      }),
    [authorizedFetch, fetchInitialData]
  );

  const updateChannelSection = React.useCallback(
    (sectionId, { name, channelIds }) =>
      authorizedFetch(`/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channels: channelIds == null ? undefined : unique(channelIds),
        }),
      }).then((res) => {
        // TODO
        fetchInitialData();
        return res;
      }),
    [authorizedFetch, fetchInitialData]
  );

  const deleteChannelSection = React.useCallback(
    (sectionId) =>
      authorizedFetch(`/sections/${sectionId}`, { method: "DELETE" }).then(
        (res) => {
          // TODO
          fetchInitialData();
          return res;
        }
      ),
    [authorizedFetch, fetchInitialData]
  );

  const fetchMessages = React.useCallback(
    (channelId, { limit = 50, beforeMessageId, afterMessageId } = {}) => {
      if (limit == null) throw new Error(`Missing required "limit" argument`);

      const searchParams = new URLSearchParams(
        [
          ["before", beforeMessageId],
          ["after", afterMessageId],
          ["limit", limit],
        ].filter((e) => e[1] != null)
      );

      const url = [`/channels/${channelId}/messages`, searchParams.toString()]
        .filter((s) => s !== "")
        .join("?");

      return authorizedFetch(url).then((messages) => {
        dispatch({
          type: "messages-fetched",
          channelId,
          limit,
          beforeMessageId,
          afterMessageId,
          messages,
        });

        const replies = messages.filter((m) => m.reply_to != null);

        // Fetch all messages replied to async. Works for now!
        for (let reply of replies)
          authorizedFetch(
            `/channels/${channelId}/messages/${reply.reply_to}`
          ).then((message) => {
            dispatch({
              type: "message-fetched",
              message: message ?? {
                id: reply.reply_to,
                channel: channelId,
                deleted: true,
              },
            });
          });

        return messages;
      });
    },
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

  const markChannelRead = useLatestCallback(
    (channelId, { readAt }) => {
      // TODO: Undo if request fails
      dispatch({ type: "mark-channel-read-request-sent", channelId, readAt });
      return authorizedFetch(`/channels/${channelId}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_read_at: readAt.toISOString() }),
      });
    },
    [authorizedFetch]
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

  const createMessage = useLatestCallback(
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
      }).then(
        (message) => {
          dispatch({
            type: "message-create-request-successful",
            message,
            optimisticEntryId: dummyId,
          });
          markChannelRead(message.channel, {
            readAt: new Date(message.created_at),
          });
          return message;
        },
        (error) => {
          dispatch({
            type: "message-create-request-failed",
            error,
            channelId: channel,
            optimisticEntryId: dummyId,
          });
          return Promise.reject(error);
        }
      );
    }
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

  const fetchChannel = useLatestCallback(
    (id) =>
      authorizedFetch(`/channels/${id}`).then((res) => {
        dispatch({ type: "fetch-channel-request-successful", channel: res });
        return res;
      }),
    [authorizedFetch]
  );

  const createChannel = React.useCallback(
    ({ name, kind, serverId, memberUserIds, memberWalletAddresses }) =>
      authorizedFetch("/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind,
          server: serverId,
          members: memberWalletAddresses ?? memberUserIds,
        }),
      }).then((res) => {
        // TODO
        fetchInitialData();
        return res;
      }),
    [authorizedFetch, fetchInitialData]
  );

  const updateChannel = React.useCallback(
    (id, { name }) =>
      authorizedFetch(`/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((res) => {
        // TODO
        fetchInitialData();
        return res;
      }),
    [authorizedFetch, fetchInitialData]
  );

  const deleteChannel = useLatestCallback((id) =>
    authorizedFetch(`/channels/${id}`, { method: "DELETE" }).then((res) => {
      dispatch({ type: "delete-channel-request-successful", id });
      return res;
    })
  );

  const fetchStarredItems = useLatestCallback(() =>
    authorizedFetch("/stars").then((res) => {
      dispatch({
        type: "fetch-starred-channels-request-successful",
        stars: res.map((s) => ({ id: s.id, channelId: s.channel })),
      });
      return res;
    })
  );

  const starChannel = useLatestCallback((channelId) =>
    authorizedFetch("/stars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: channelId }),
    }).then((res) => {
      dispatch({
        type: "star-channel-request-successful",
        star: { id: res.id, channelId },
      });
      return res;
    })
  );

  const unstarChannel = useLatestCallback((channelId) => {
    const starId = stateSelectors.selectChannelStarId(channelId);
    return authorizedFetch(`/stars/${starId}`, { method: "DELETE" }).then(
      (res) => {
        dispatch({ type: "unstar-channel-request-successful", channelId });
        return res;
      }
    );
  });

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

  const registerChannelTypingActivity = React.useCallback(
    (channelId) =>
      authorizedFetch(`/channels/${channelId}/typing`, { method: "POST" }),
    [authorizedFetch]
  );

  const actions = React.useMemo(
    () => ({
      logout,
      fetchPublicServerData,
      fetchInitialData,
      fetchMessage,
      updateMe,
      fetchMessages,
      fetchServers,
      createServer,
      updateServer,
      joinServer,
      updateChannelSection,
      deleteChannelSection,
      createServerChannelSection,
      updateServerChannelSections,
      fetchChannel,
      createChannel,
      updateChannel,
      deleteChannel,
      createMessage,
      updateMessage,
      removeMessage,
      addMessageReaction,
      removeMessageReaction,
      markChannelRead,
      fetchStarredItems,
      starChannel,
      unstarChannel,
      uploadImage,
      registerChannelTypingActivity,
    }),
    [
      logout,
      fetchPublicServerData,
      fetchInitialData,
      fetchMessage,
      updateMe,
      fetchMessages,
      fetchServers,
      createServer,
      updateServer,
      joinServer,
      createServerChannelSection,
      updateServerChannelSections,
      updateChannelSection,
      deleteChannelSection,
      fetchChannel,
      createChannel,
      updateChannel,
      deleteChannel,
      createMessage,
      updateMessage,
      removeMessage,
      addMessageReaction,
      removeMessageReaction,
      markChannelRead,
      fetchStarredItems,
      starChannel,
      unstarChannel,
      uploadImage,
      registerChannelTypingActivity,
    ]
  );

  React.useEffect(() => {
    let typingEndedTimeoutHandles = {};

    const handler = (name, data) => {
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

      dispatch({ type: ["server-event", name].join(":"), data, user });
    };

    const removeListener = serverConnection.addListener(handler);
    return () => {
      removeListener();
    };
  }, [user, serverConnection, dispatch]);

  const contextValue = React.useMemo(
    () => ({
      serverConnection,
      state: stateSelectors,
      actions,
      addBeforeDispatchListener,
      addAfterDispatchListener,
    }),
    [
      stateSelectors,
      actions,
      serverConnection,
      addBeforeDispatchListener,
      addAfterDispatchListener,
    ]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};
