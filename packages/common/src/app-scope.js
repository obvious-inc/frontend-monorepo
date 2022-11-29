import React from "react";
import { useAuth } from "./auth";
import { generateDummyId } from "./utils/misc";
import { unique } from "./utils/array";
import { pickKeys, mapValues } from "./utils/object";
import invariant from "./utils/invariant";
import { stringifyBlocks as stringifyMessageBlocks } from "./utils/message";
import {
  openChannelPermissionOverrides,
  closedChannelPermissionOverrides,
  privateChannelPermissionOverrides,
} from "./utils/permissions";
import useRootReducer from "./hooks/root-reducer";
import useLatestCallback from "./hooks/latest-callback";

const cleanString = (s) => {
  if (typeof s !== "string") return s;
  return s.trim() === "" ? null : s.trim();
};

const createApiParsers = ({ buildCloudflareImageUrl }) => ({
  parseUser(u) {
    const createProfilePicture = () => {
      if ((u.pfp.cf_id ?? "") == "")
        return {
          small: u.pfp.input_image_url,
          large: u.pfp.input_image_url,
        };

      return {
        small: buildCloudflareImageUrl(u.pfp.cf_id, { size: "small" }),
        large: buildCloudflareImageUrl(u.pfp.cf_id, { size: "large" }),
        isVerifiedNft: u.pfp.verified,
      };
    };

    const parsedData = { ...u };

    if (u.wallet_address != null) parsedData.walletAddress = u.wallet_address;
    if (u.display_name != null && u.display_name.trim() !== "")
      parsedData.displayName = u.display_name;
    if (u.push_tokens != null) parsedData.pushTokens = u.push_tokens;
    if (u.pfp != null) parsedData.profilePicture = createProfilePicture();
    if (u.created_at != null) parsedData.createdAt = u.created_at;

    return parsedData;
  },
  parseChannel(rawChannel) {
    const normalizeString = (s) => {
      if (s == null) return null;
      return s.trim() === "" ? null : s;
    };

    const channel = {
      id: rawChannel.id,
      name: normalizeString(rawChannel.name),
      description: normalizeString(rawChannel.description),
      kind: rawChannel.kind,
      createdAt: rawChannel.created_at,
      lastMessageAt: rawChannel.last_message_at,
      memberUserIds: rawChannel.members ?? [],
      ownerUserId: rawChannel.owner,
      isDeleted: rawChannel.deleted,
    };

    if (normalizeString(rawChannel.avatar) == null) return channel;

    if (rawChannel.avatar.match(/^https?:\/\//)) {
      const url = rawChannel.avatar;
      return { ...channel, image: url, imageLarge: url };
    }

    const image = buildCloudflareImageUrl(rawChannel.avatar, { size: "small" });
    const imageLarge = buildCloudflareImageUrl(rawChannel.avatar, {
      size: "large",
    });

    return { ...channel, image, imageLarge };
  },
});

const Context = React.createContext({});

export const useAppScope = () => React.useContext(Context);

export const Provider = ({ cloudflareAccountHash, children }) => {
  const {
    status: authStatus,
    authorizedFetch,
    logout: clearAuthTokens,
  } = useAuth();
  const [
    stateSelectors,
    dispatch,
    { addBeforeDispatchListener, addAfterDispatchListener },
  ] = useRootReducer();

  const buildCloudflareImageUrl = React.useCallback(
    (cloudflareId, { size } = {}) => {
      const variantNameBySizeName = { small: "avatar", large: "public" };
      const variant = variantNameBySizeName[size];
      if (variant == null) throw new Error();
      return `https://imagedelivery.net/${cloudflareAccountHash}/${cloudflareId}/${variant}`;
    },
    [cloudflareAccountHash]
  );

  const { parseUser, parseChannel } = createApiParsers({
    buildCloudflareImageUrl,
  });

  const me = stateSelectors.selectMe();

  const logout = useLatestCallback(() => {
    clearAuthTokens();
    dispatch({ type: "logout" });
  });

  const fetchMe = useLatestCallback(() =>
    authorizedFetch("/users/me").then((me) => {
      const user = parseUser(me);
      dispatch({ type: "fetch-me-request-successful", user });
      return user;
    })
  );

  const updateMe = useLatestCallback(
    ({ displayName, profilePicture, pushTokens }) =>
      authorizedFetch("/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          pfp: profilePicture,
          push_tokens: pushTokens,
        }),
      })
  );

  const deleteMe = useLatestCallback(() =>
    authorizedFetch("/users/me", { method: "DELETE" })
  );

  const fetchBlockedUsers = useLatestCallback(async () => {
    const blocks = await authorizedFetch("/users/me/blocks");
    const userIds = blocks.map((b) => b.user);
    dispatch({ type: "fetch-blocked-users:request-successful", userIds });
    return userIds;
  });

  const fetchPreferences = useLatestCallback(() =>
    authorizedFetch("/users/me/preferences", { priority: "low" }).then(
      (preferences) => {
        const notificationSettingsByChannelId = mapValues(
          (s) => (s.muted ? "off" : s.mentions ? "mentions" : "all"),
          preferences?.channels ?? {}
        );
        dispatch({
          type: "fetch-preferences:request-successful",
          notificationSettingsByChannelId,
        });

        return preferences;
      }
    )
  );

  const setChannelNotificationSetting = useLatestCallback(
    async (channelId, setting) => {
      dispatch({
        type: "set-channel-notification-setting:request-sent",
        channelId,
        setting,
      });

      const preferences = await authorizedFetch("/users/me/preferences");

      return authorizedFetch("/users/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: {
            ...preferences?.channels,
            [channelId]:
              setting === "off"
                ? { muted: true }
                : setting === "mentions"
                ? { mentions: true }
                : {},
          },
        }),
      });
    }
  );

  const registerDevicePushToken = useLatestCallback((token) =>
    updateMe({ pushTokens: unique([...me.pushTokens, token]) })
  );

  const fetchUsers = useLatestCallback((userIds) =>
    authorizedFetch("/users/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_ids: userIds }),
    }).then((rawUsers) => {
      const users = userIds.map((id) => {
        const rawUser = rawUsers.find((u) => u.id === id);
        if (rawUser == null) return { id, deleted: true };
        return parseUser(rawUser);
      });

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
              `/channels/${channelId}/messages/${reply.reply_to}`,
              { allowUnauthorized: true }
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

          // Beautifuly fetch non-member users
          if (authStatus === "authenticated")
            fetchChannel(channelId).then((c) => {
              const userIds = messages
                .filter((m) => !c.memberUserIds.includes(m.author))
                .map((m) => m.author);
              fetchUsers(userIds);
            });

          return messages;
        }
      );
    }
  );

  const markChannelRead = useLatestCallback((channelId) => {
    const lastMessageAt = stateSelectors.selectChannelLastMessageAt(channelId);

    // Use the current time in case the channel is empty
    const readAt = lastMessageAt == null ? new Date() : lastMessageAt;

    // TODO: Undo if request fails
    dispatch({ type: "mark-channel-read:request-sent", channelId, readAt });

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
    async ({ channel, blocks, replyToMessageId }) => {
      // TODO: Less hacky optimistc UI
      const message = {
        channel,
        blocks,
        content: stringifyMessageBlocks(blocks),
        reply_to: replyToMessageId,
      };
      const dummyId = generateDummyId();

      dispatch({
        type: "message-create-request-sent",
        message: {
          ...message,
          id: dummyId,
          created_at: new Date().toISOString(),
          author: me.id,
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

  const updateMessage = useLatestCallback(async (messageId, { blocks }) => {
    return authorizedFetch(`/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks, content: stringifyMessageBlocks(blocks) }),
    }).then((message) => {
      dispatch({
        type: "message-update-request-successful",
        message,
      });
      return message;
    });
  });

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

  const reportMessage = useLatestCallback(async (messageId, { comment }) => {
    return authorizedFetch(`/messages/${messageId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment, reason: "other" }),
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
      userId: me.id,
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
        userId: me.id,
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
      (rawChannel) => {
        const channel = parseChannel(rawChannel);
        dispatch({ type: "fetch-channel-request-successful", channel });
        return channel;
      }
    )
  );

  const fetchUserChannels = useLatestCallback(() =>
    authorizedFetch("/users/me/channels").then((rawChannels) => {
      const channels = rawChannels.map(parseChannel);
      dispatch({ type: "fetch-user-channels-request-successful", channels });
      return channels;
    })
  );

  const fetchPubliclyReadableChannels = useLatestCallback(() =>
    authorizedFetch("/channels/@public", { allowUnauthorized: true }).then(
      (rawChannels) => {
        const channels = rawChannels.map(parseChannel);
        dispatch({
          type: "fetch-publicly-readable-channels-request-successful",
          channels,
        });
        return channels;
      }
    )
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
    }).then((rawMembers) => {
      const members = rawMembers.map(parseUser);
      dispatch({
        type: "fetch-channel-members-request-successful",
        channelId: id,
        members,
      });
      return members;
    })
  );

  const fetchChannelPermissions = useLatestCallback((id) =>
    authorizedFetch(`/channels/${id}/permissions`, { priority: "low" }).then(
      (res) => {
        dispatch({
          type: "fetch-channel-permissions:request-successful",
          channelId: id,
          permissions: res,
        });
        return res;
      }
    )
  );

  const fetchChannelPublicPermissions = useLatestCallback((id) =>
    authorizedFetch(`/channels/${id}/permissions`, {
      unauthorized: true,
      priority: "low",
    })
      .catch((e) => {
        if (e.code === 404) return [];
        throw e;
      })
      .then((res) => {
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
      fetchChannel(channelId);
      fetchChannelMembers(channelId);
      // fetchInitialData();
      return res;
    })
  );

  const leaveChannel = useLatestCallback((channelId) => {
    dispatch({ type: "leave-channel:request-sent", channelId, userId: me.id });
    return authorizedFetch(`/channels/${channelId}/members/me`, {
      method: "DELETE",
    }).then((res) => {
      // TODO
      fetchChannelMembers(channelId);
      // fetchInitialData();
      return res;
    });
  });

  const updateChannel = useLatestCallback((id, { name, description, avatar }) =>
    authorizedFetch(`/channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cleanString(name),
        description: cleanString(description),
        avatar: cleanString(avatar),
      }),
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
      fetchChannelPermissions(channelId);
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
        type: "fetch-starred-items:request-successful",
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
    const [
      { user: rawMe, channels: rawChannels, read_states: readStates, apps },
      starredItems,
    ] = await Promise.all([
      authorizedFetch("/ready"),
      fetchStarredItems(),
      fetchBlockedUsers(),
    ]);

    // TODO: Change this
    const missingChannelStars = starredItems.filter(
      (i) =>
        i.type === "channel" && rawChannels.every((c) => c.id !== i.reference)
    );

    if (missingChannelStars.length !== 0)
      await Promise.all(
        missingChannelStars.map((s) =>
          fetchChannel(s.reference).catch((e) => {
            // 403 may happen if you have starred a channel you no longer have access to
            if (e.code !== 403 && e.code !== 404) throw e;
          })
        )
      );

    fetchPreferences();

    const me = parseUser(rawMe);
    const channels = rawChannels.map(parseChannel);

    dispatch({
      type: "fetch-client-boot-data-request-successful",
      user: me,
      channels,
      readStates,
      apps,
      // starredItems,
    });

    return { user: me, channels, readStates, starredItems };
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

  const starChannel = useLatestCallback((channelId) => {
    dispatch({
      type: "star-channel:request-sent",
      channelId,
      star: { id: generateDummyId() },
    });
    return starItem({ type: "channel", reference: channelId }).then((res) => {
      dispatch({
        type: "star-channel:request-successful",
        channelId,
        star: { id: res.id },
      });
      return res;
    });
  });

  const unstarChannel = useLatestCallback((channelId) => {
    const starId = stateSelectors.selectChannelStarId(channelId);
    dispatch({ type: "unstar-channel:request-sent", channelId });
    return unstarItem(starId).then((res) => {
      dispatch({ type: "unstar-channel:request-successful", channelId });
      return res;
    });
  });

  const starUser = useLatestCallback((userId) =>
    starItem({ type: "user", reference: userId }).then((res) => {
      dispatch({
        type: "star-user:request-successful",
        userId,
        star: { id: res.id },
      });
      return res;
    })
  );

  const unstarUser = useLatestCallback((userId) => {
    const starId = stateSelectors.selectUserStarId(userId);
    return unstarItem(starId).then((res) => {
      dispatch({ type: "unstar-user:request-successful", userId });
      return res;
    });
  });

  const reportUser = useLatestCallback((userId, { comment }) =>
    authorizedFetch("/users/me/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: userId, reason: "other", comment }),
    })
  );

  const blockUser = useLatestCallback(async (userId) => {
    await authorizedFetch("/users/me/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: userId }),
    });
    await fetchBlockedUsers();
  });

  const unblockUser = useLatestCallback(async (userId) => {
    await authorizedFetch(`/users/me/blocks/${userId}`, { method: "DELETE" });
    await fetchBlockedUsers();
  });

  const uploadImage = useLatestCallback(({ files }) => {
    const formData = new FormData();
    for (let file of files) formData.append("files", file);
    return authorizedFetch("/media/images", {
      method: "POST",
      body: formData,
    }).then((files) =>
      files.map((f) => ({
        ...f,
        urls: {
          small: buildCloudflareImageUrl(f.id, { size: "small" }),
          large: buildCloudflareImageUrl(f.id, { size: "large" }),
        },
      }))
    );
  });

  const uploadImageWithUrl = useLatestCallback((url) =>
    authorizedFetch("/media/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).then(({ id }) => ({
      url: buildCloudflareImageUrl(id, { size: "large" }),
    }))
  );

  const registerChannelTypingActivity = useLatestCallback((channelId) =>
    authorizedFetch(`/channels/${channelId}/typing`, { method: "POST" })
  );

  const searchGifs = useLatestCallback((query) =>
    authorizedFetch(`/integrations/tenor/search?q=${query}`)
  );

  const promptDalle = useLatestCallback((prompt) =>
    authorizedFetch(
      `/integrations/dalle/generate?prompt=${encodeURIComponent(prompt)}`,
      { method: "POST" }
    )
  );

  const registerEnsNames = useLatestCallback((namesByAddress) => {
    dispatch({
      type: "resolve-ens-names:request-successful",
      namesByAddress,
    });
  });

  const dispatchServerEvent = useLatestCallback((name, data) => {
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

  const actions = React.useMemo(
    () => ({
      logout,
      fetchMe,
      fetchPreferences,
      fetchBlockedUsers,
      blockUser,
      unblockUser,
      reportUser,
      reportMessage,
      fetchClientBootData,
      fetchMessage,
      updateMe,
      deleteMe,
      setChannelNotificationSetting,
      registerDevicePushToken,
      fetchUsers,
      fetchMessages,
      fetchUserChannels,
      fetchUserChannelsReadStates,
      fetchChannel,
      fetchPubliclyReadableChannels,
      createDmChannel,
      createOpenChannel,
      createClosedChannel,
      createPrivateChannel,
      fetchChannelMembers,
      fetchChannelPermissions,
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
      uploadImageWithUrl,
      registerChannelTypingActivity,
      searchGifs,
      promptDalle,
      registerEnsNames,
    }),
    [
      logout,
      fetchMe,
      fetchPreferences,
      fetchBlockedUsers,
      blockUser,
      unblockUser,
      reportUser,
      reportMessage,
      fetchClientBootData,
      fetchMessage,
      updateMe,
      deleteMe,
      setChannelNotificationSetting,
      registerDevicePushToken,
      fetchUsers,
      fetchMessages,
      fetchUserChannels,
      fetchUserChannelsReadStates,
      fetchChannel,
      fetchPubliclyReadableChannels,
      createDmChannel,
      createOpenChannel,
      createClosedChannel,
      createPrivateChannel,
      makeChannelOpen,
      makeChannelClosed,
      makeChannelPrivate,
      fetchChannelMembers,
      fetchChannelPermissions,
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
      uploadImageWithUrl,
      registerChannelTypingActivity,
      searchGifs,
      promptDalle,
      registerEnsNames,
    ]
  );

  const contextValue = React.useMemo(
    () => ({
      dispatchServerEvent,
      state: stateSelectors,
      actions,
      addBeforeDispatchListener,
      addAfterDispatchListener,
    }),
    [
      dispatchServerEvent,
      stateSelectors,
      actions,
      addBeforeDispatchListener,
      addAfterDispatchListener,
    ]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};
