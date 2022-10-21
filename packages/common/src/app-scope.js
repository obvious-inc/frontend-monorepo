import React from "react";
import { useAuth } from "./auth";
import { generateDummyId } from "./utils/misc";
import { pickKeys } from "./utils/object";
import invariant from "./utils/invariant";
import {
  openChannelPermissionOverrides,
  closedChannelPermissionOverrides,
  privateChannelPermissionOverrides,
} from "./utils/permissions";
import useRootReducer from "./hooks/root-reducer";
import useLatestCallback from "./hooks/latest-callback";

const Context = React.createContext({});

export const useAppScope = () => React.useContext(Context);

export const Provider = ({ children }) => {
  const { authorizedFetch, logout: clearAuthTokens } = useAuth();
  const [
    stateSelectors,
    dispatch,
    { addBeforeDispatchListener, addAfterDispatchListener },
  ] = useRootReducer();

  const user = stateSelectors.selectMe();

  const logout = useLatestCallback(() => {
    clearAuthTokens();
    dispatch({ type: "logout" });
  });

  const fetchMe = useLatestCallback(() =>
    authorizedFetch("/users/me").then((user) => {
      dispatch({ type: "fetch-me-request-successful", user });
      return user;
    })
  );

  const updateMe = useLatestCallback(({ displayName, pfp }) =>
    authorizedFetch("/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName, pfp }),
    })
  );

  const fetchUsers = useLatestCallback((userIds) =>
    authorizedFetch("/users/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_ids: userIds }),
    }).then((users) => {
      dispatch({ type: "fetch-users-request-successful", users });
      return users;
    })
  );

  const fetchMessages = useLatestCallback(
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

      return authorizedFetch(url, { allowUnauthorized: true }).then(
        (messages) => {
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
        }
      );
    }
  );

  const markChannelRead = useLatestCallback((channelId) => {
    const unsortedMessages = stateSelectors.selectChannelMessages(channelId);
    const messages = [...unsortedMessages].sort(
      (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
    );

    // Ignore the users’s own messages before we know they have been persisted
    const lastPersistedMessage = messages
      .filter((m) => !m.isOptimistic)
      .slice(-1)[0];

    // Use the current time in case the channel is empty
    const readAt =
      lastPersistedMessage == null
        ? new Date()
        : new Date(lastPersistedMessage.createdAt);

    // TODO: Undo if request fails
    dispatch({ type: "mark-channel-read-request-sent", channelId, readAt });
    return authorizedFetch(`/channels/${channelId}/ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_read_at: readAt.toISOString() }),
    });
  });

  const fetchMessage = useLatestCallback((id) =>
    authorizedFetch(`/messages/${id}`).then((message) => {
      dispatch({
        type: "message-fetch-request-successful",
        message,
      });
      return message;
    })
  );

  const createMessage = useLatestCallback(
    async ({ channel, content, blocks, replyToMessageId }) => {
      // TODO: Less hacky optimistc UI
      const message = {
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

  const updateMessage = useLatestCallback(
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
    }
  );

  const removeMessage = useLatestCallback(async (messageId) => {
    return authorizedFetch(`/messages/${messageId}`, {
      method: "DELETE",
    }).then((message) => {
      dispatch({
        type: "message-delete-request-successful",
        messageId,
      });
      return message;
    });
  });

  const addMessageReaction = useLatestCallback(async (messageId, { emoji }) => {
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
  });

  const removeMessageReaction = useLatestCallback(
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
    }
  );

  const fetchChannel = useLatestCallback((id) =>
    authorizedFetch(`/channels/${id}`, { allowUnauthorized: true }).then(
      (res) => {
        dispatch({ type: "fetch-channel-request-successful", channel: res });
        return res;
      }
    )
  );

  const fetchUserChannels = useLatestCallback(() =>
    authorizedFetch("/users/me/channels").then((channels) => {
      dispatch({ type: "fetch-user-channels-request-successful", channels });
      return channels;
    })
  );

  const fetchUserChannelsReadStates = useLatestCallback(() =>
    authorizedFetch("/users/me/read_states").then((readStates) => {
      dispatch({
        type: "fetch-user-channels-read-states-request-successful",
        readStates,
      });
      return readStates;
    })
  );

  const createChannel = useLatestCallback(
    ({
      name,
      description,
      memberUserIds,
      memberWalletAddresses,
      permissionOverwrites,
    }) => {
      return authorizedFetch("/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "topic",
          name,
          description,
          members: memberWalletAddresses ?? memberUserIds,
          permission_overwrites: permissionOverwrites,
        }),
      }).then((res) => {
        // TODO
        fetchUserChannels();
        // fetchInitialData();
        return res;
      });
    }
  );

  const createDmChannel = useLatestCallback(
    ({ name, memberUserIds, memberWalletAddresses }) =>
      authorizedFetch("/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind: "dm",
          members: memberWalletAddresses ?? memberUserIds,
        }),
      }).then((res) => {
        // TODO
        fetchUserChannels();
        // fetchInitialData();
        return res;
      })
  );

  const createOpenChannel = useLatestCallback(({ name, description }) =>
    createChannel({
      name,
      description,
      permissionOverwrites: openChannelPermissionOverrides,
    })
  );

  const createClosedChannel = useLatestCallback(
    ({ name, description, memberWalletAddresses, memberUserIds }) =>
      createChannel({
        name,
        description,
        memberWalletAddresses,
        memberUserIds,
        permissionOverwrites: closedChannelPermissionOverrides,
      })
  );

  const createPrivateChannel = useLatestCallback(
    ({ name, description, memberUserIds, memberWalletAddresses }) =>
      createChannel({
        name,
        description,
        memberWalletAddresses,
        memberUserIds,
        permissionOverwrites: privateChannelPermissionOverrides,
      })
  );

  const fetchChannelMembers = useLatestCallback((id) =>
    authorizedFetch(`/channels/${id}/members`, {
      allowUnauthorized: true,
    }).then((res) => {
      dispatch({
        type: "fetch-channel-members-request-successful",
        channelId: id,
        members: res,
      });
      return res;
    })
  );

  const fetchChannelPublicPermissions = useLatestCallback((id) =>
    authorizedFetch(`/channels/${id}/permissions`, {
      unauthorized: true,
      priority: "low",
    }).then((res) => {
      dispatch({
        type: "fetch-channel-public-permissions-request-successful",
        channelId: id,
        permissions: res,
      });
      return res;
    })
  );

  const addChannelMember = useLatestCallback(
    (channelId, walletAddressOrUserId) =>
      authorizedFetch(`/channels/${channelId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          members: Array.isArray(walletAddressOrUserId)
            ? walletAddressOrUserId
            : [walletAddressOrUserId],
        }),
      }).then((res) => {
        // TODO
        fetchChannelMembers(channelId);
        // fetchInitialData();
        return res;
      })
  );

  const removeChannelMember = useLatestCallback((channelId, userId) =>
    authorizedFetch(`/channels/${channelId}/members/${userId}`, {
      method: "DELETE",
    }).then((res) => {
      // TODO
      fetchChannelMembers(channelId);
      // fetchInitialData();
      return res;
    })
  );

  const joinChannel = useLatestCallback((channelId) =>
    authorizedFetch(`/channels/${channelId}/join`, {
      method: "POST",
    }).then((res) => {
      // TODO
      fetchChannelMembers(channelId);
      // fetchInitialData();
      return res;
    })
  );

  const leaveChannel = useLatestCallback((channelId) =>
    authorizedFetch(`/channels/${channelId}/members/me`, {
      method: "DELETE",
    }).then((res) => {
      // TODO
      fetchChannelMembers(channelId);
      // fetchInitialData();
      return res;
    })
  );

  const updateChannel = useLatestCallback((id, { name, description, avatar }) =>
    authorizedFetch(`/channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, avatar }),
    }).then((res) => {
      // TODO
      fetchChannel(id);
      // fetchInitialData();
      return res;
    })
  );

  const deleteChannel = useLatestCallback((id) =>
    authorizedFetch(`/channels/${id}`, { method: "DELETE" }).then((res) => {
      dispatch({ type: "delete-channel-request-successful", id });
      return res;
    })
  );

  const updateChannelPermissions = useLatestCallback((channelId, permissions) =>
    authorizedFetch(`/channels/${channelId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(permissions),
    }).then((res) => {
      // TODO permissions?
      fetchChannelPublicPermissions(channelId);
      // fetchInitialData();
      return res;
    })
  );

  const makeChannelOpen = useLatestCallback((channelId) =>
    updateChannelPermissions(channelId, openChannelPermissionOverrides)
  );

  const makeChannelClosed = useLatestCallback((channelId) =>
    updateChannelPermissions(channelId, closedChannelPermissionOverrides)
  );
  const makeChannelPrivate = useLatestCallback((channelId) =>
    updateChannelPermissions(channelId, privateChannelPermissionOverrides)
  );

  const fetchStarredItems = useLatestCallback(() =>
    authorizedFetch("/stars", { priority: "low" }).then((res) => {
      dispatch({
        type: "fetch-starred-items-request-successful",
        stars: res.map((s) => pickKeys(["id", "type", "reference"], s)),
      });
      return res;
    })
  );

  const fetchApps = useLatestCallback(() =>
    authorizedFetch("/apps", { allowUnauthorized: true, priority: "low" }).then(
      (res) => {
        dispatch({ type: "fetch-apps-request-successful", apps: res });
        return res;
      }
    )
  );

  const fetchClientBootData = useLatestCallback(async () => {
    const [{ user, channels, read_states: readStates, apps }, starredItems] =
      await Promise.all([authorizedFetch("/ready"), fetchStarredItems()]);

    // TODO: Change this
    const missingChannelStars = starredItems.filter(
      (i) => i.type === "channel" && channels.every((c) => c.id !== i.reference)
    );

    if (missingChannelStars.length !== 0)
      await Promise.all(
        missingChannelStars.map((s) => fetchChannel(s.reference))
      );

    dispatch({
      type: "fetch-client-boot-data-request-successful",
      user,
      channels,
      readStates,
      apps,
      // starredItems,
    });

    return { user, channels, readStates, starredItems };
  });

  const starItem = useLatestCallback(({ type, reference }) =>
    authorizedFetch("/stars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, reference }),
    })
  );

  const unstarItem = useLatestCallback((starId) =>
    authorizedFetch(`/stars/${starId}`, { method: "DELETE" })
  );

  const starChannel = useLatestCallback((channelId) =>
    starItem({ type: "channel", reference: channelId }).then((res) => {
      dispatch({
        type: "star-channel-request-successful",
        channelId,
        star: { id: res.id },
      });
      return res;
    })
  );

  const unstarChannel = useLatestCallback((channelId) => {
    const starId = stateSelectors.selectChannelStarId(channelId);
    return unstarItem(starId).then((res) => {
      dispatch({ type: "unstar-channel-request-successful", channelId });
      return res;
    });
  });

  const starUser = useLatestCallback((userId) =>
    starItem({ type: "user", reference: userId }).then((res) => {
      dispatch({
        type: "star-user-request-successful",
        userId,
        star: { id: res.id },
      });
      return res;
    })
  );

  const unstarUser = useLatestCallback((userId) => {
    const starId = stateSelectors.selectUserStarId(userId);
    return unstarItem(starId).then((res) => {
      dispatch({ type: "unstar-user-request-successful", userId });
      return res;
    });
  });

  const uploadImage = useLatestCallback(({ files }) => {
    const formData = new FormData();
    for (let file of files) formData.append("files", file);
    return authorizedFetch("/media/images", {
      method: "POST",
      body: formData,
    });
  });

  const registerChannelTypingActivity = useLatestCallback((channelId) =>
    authorizedFetch(`/channels/${channelId}/typing`, { method: "POST" })
  );

  const searchGifs = useLatestCallback((query) =>
    authorizedFetch(`/integrations/tenor/search?q=${query}`)
  );

  const actions = React.useMemo(
    () => ({
      logout,
      fetchMe,
      fetchClientBootData,
      fetchMessage,
      updateMe,
      fetchUsers,
      fetchMessages,
      fetchUserChannels,
      fetchUserChannelsReadStates,
      fetchChannel,
      createDmChannel,
      createOpenChannel,
      createClosedChannel,
      createPrivateChannel,
      fetchChannelMembers,
      fetchChannelPublicPermissions,
      addChannelMember,
      removeChannelMember,
      joinChannel,
      leaveChannel,
      updateChannel,
      deleteChannel,
      makeChannelOpen,
      makeChannelClosed,
      makeChannelPrivate,
      createMessage,
      updateMessage,
      removeMessage,
      addMessageReaction,
      removeMessageReaction,
      markChannelRead,
      fetchStarredItems,
      starChannel,
      unstarChannel,
      starUser,
      unstarUser,
      fetchApps,
      uploadImage,
      registerChannelTypingActivity,
      searchGifs,
    }),
    [
      logout,
      fetchMe,
      fetchClientBootData,
      fetchMessage,
      updateMe,
      fetchUsers,
      fetchMessages,
      fetchUserChannels,
      fetchUserChannelsReadStates,
      fetchChannel,
      createDmChannel,
      createOpenChannel,
      createClosedChannel,
      createPrivateChannel,
      makeChannelOpen,
      makeChannelClosed,
      makeChannelPrivate,
      fetchChannelMembers,
      fetchChannelPublicPermissions,
      addChannelMember,
      removeChannelMember,
      joinChannel,
      leaveChannel,
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
      starUser,
      unstarUser,
      fetchApps,
      uploadImage,
      registerChannelTypingActivity,
      searchGifs,
    ]
  );

  const contextValue = React.useMemo(
    () => ({
      dispatch,
      state: stateSelectors,
      actions,
      addBeforeDispatchListener,
      addAfterDispatchListener,
    }),
    [
      dispatch,
      stateSelectors,
      actions,
      addBeforeDispatchListener,
      addAfterDispatchListener,
    ]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};
