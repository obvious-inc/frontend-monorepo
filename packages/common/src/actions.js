import { generateDummyId } from "./utils/misc.js";
import { unique } from "./utils/array.js";
import { pickKeys, mapValues } from "./utils/object.js";
import invariant from "./utils/invariant.js";
import {
  stringifyBlocks as stringifyMessageBlocks,
  getMentions,
} from "./utils/message.js";
import { isEmoji } from "./utils/emoji.js";
import {
  openChannelPermissionOverrides,
  closedChannelPermissionOverrides,
  privateChannelPermissionOverrides,
} from "./utils/permissions.js";
import { selectMe } from "./reducers/me.js";
import { selectUserStarId } from "./reducers/users.js";
import {
  selectChannelLastMessageAt,
  selectChannelStarId,
} from "./reducers/channels.js";

const cleanString = (s) => {
  if (typeof s !== "string") return s;
  return s.trim() === "" ? null : s.trim();
};

export default ({
  dispatch,
  authStatus,
  authorizedFetch,
  getStoreState,
  cacheStore,
  parseUser,
  parseChannel,
  parseMessage,
  buildCloudflareImageUrl,
  authTokenStore,
}) => {
  const fetchMe = () =>
    authorizedFetch("/users/me").then((me) => {
      const user = parseUser(me);
      dispatch({ type: "fetch-me-request-successful", user });
      return user;
    });

  const updateMe = async ({
    displayName,
    description,
    profilePicture,
    pushTokens,
  }) => {
    const rawUser = await authorizedFetch("/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        description,
        pfp: profilePicture,
        push_tokens: pushTokens,
      }),
    });
    const user = parseUser(rawUser);
    dispatch({ type: "update-me:request-successful", user });
    return user;
  };

  const fetchUsers = (userIds) =>
    authorizedFetch("/users/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_ids: userIds }),
    }).then((rawUsers) => {
      // Assuming missing users are deleted here
      // TODO: Make this less brittle
      const users = userIds.map((id) => {
        const rawUser = rawUsers.find((u) => u.id === id);
        if (rawUser == null) return { id, deleted: true };
        return parseUser(rawUser);
      });

      dispatch({ type: "fetch-users-request-successful", users });
      return users;
    });

  const fetchUserChannels = (accountAddress) => {
    if (accountAddress == null)
      return authorizedFetch("/users/me/channels").then((rawChannels) => {
        const channels = rawChannels.map(parseChannel);
        dispatch({ type: "fetch-user-channels-request-successful", channels });
        return channels;
      });

    return authorizedFetch(`/users/${accountAddress}/channels`, {
      allowUnauthorized: true,
    }).then((rawChannels) => {
      const channels = rawChannels.map(parseChannel);
      dispatch({ type: "fetch-user-channels-request-successful", channels });
      return channels;
    });
  };

  const fetchUserChannelsReadStates = () =>
    authorizedFetch("/users/me/read_states").then((readStates) => {
      dispatch({
        type: "fetch-user-channels-read-states-request-successful",
        readStates,
      });
      return readStates;
    });

  const fetchChannel = (id) =>
    authorizedFetch(`/channels/${id}`, {
      allowUnauthorized: true,
    }).then((rawChannel) => {
      const channel = parseChannel(rawChannel);
      dispatch({ type: "fetch-channel-request-successful", channel });
      return channel;
    });

  const createChannel = ({
    name,
    description,
    body,
    memberUserIds,
    memberWalletAddresses,
    permissionOverwrites,
  }) =>
    authorizedFetch("/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "topic",
        name,
        description,
        body,
        members: memberWalletAddresses ?? memberUserIds,
        permission_overwrites: permissionOverwrites,
      }),
    }).then((res) => {
      // TODO
      fetchUserChannels();
      // fetchInitialData();
      return res;
    });

  const fetchChannelMembers = (id) =>
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
    });

  const fetchChannelPermissions = (id) =>
    authorizedFetch(`/channels/${id}/permissions`, {
      priority: "low",
    }).then((res) => {
      dispatch({
        type: "fetch-channel-permissions:request-successful",
        channelId: id,
        permissions: res,
      });
      return res;
    });

  const fetchUserPrivateChannels = () =>
    authorizedFetch("/channels?scope=private").then((rawChannels) => {
      const channels = rawChannels.map(parseChannel);
      // TODO handle this action
      dispatch({ type: "fetch-channels-request-successful", channels });
      return channels;
    });

  const fetchChannelPublicPermissions = (id) =>
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
      });

  const markChannelRead = (channelId) => {
    const lastMessageAt = selectChannelLastMessageAt(
      getStoreState(),
      channelId
    );

    // Use the current time in case the channel is empty
    const readAt = lastMessageAt == null ? new Date() : lastMessageAt;

    // TODO: Undo if request fails
    dispatch({ type: "mark-channel-read:request-sent", channelId, readAt });

    return authorizedFetch(`/channels/${channelId}/ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_read_at: readAt.toISOString() }),
    });
  };

  const updateChannelPermissions = (channelId, permissions) =>
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
    });

  const fetchStarredItems = () =>
    authorizedFetch("/stars", { priority: "low" }).then((res) => {
      dispatch({
        type: "fetch-starred-items:request-successful",
        stars: res.map((s) => pickKeys(["id", "type", "reference"], s)),
      });
      return res;
    });

  const fetchBlockedUsers = async () => {
    const blocks = await authorizedFetch("/users/me/blocks");
    const userIds = blocks.map((b) => b.user);
    dispatch({ type: "fetch-blocked-users:request-successful", userIds });
    return userIds;
  };

  const fetchPreferences = () =>
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
    );

  const starItem = ({ type, reference }) =>
    authorizedFetch("/stars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, reference }),
    });

  const unstarItem = (starId) =>
    authorizedFetch(`/stars/${starId}`, { method: "DELETE" });

  const fetchClientBootDataFull = async () => {
    const [
      { user: rawMe, channels: rawChannels, read_states: readStates, apps },
      starredItems,
    ] = await Promise.all([
      authorizedFetch("/ready"),
      fetchStarredItems(),
      fetchBlockedUsers(),
    ]);

    const me = parseUser(rawMe);
    const channels = rawChannels.map(parseChannel);

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

    fetchUsers(
      unique(
        channels
          .filter((c) => c.kind === "dm")
          .flatMap((c) =>
            c.memberUserIds.filter((id) => id !== me.id).slice(0, 3)
          )
      )
    );

    dispatch({
      type: "fetch-client-boot-data-request-successful",
      user: me,
      channels,
      readStates,
      apps,
      // starredItems,
    });

    return { user: me, channels, readStates, starredItems };
  };

  const fetchClientBootDataPrivate = async () => {
    const [
      rawChannels,
      rawMe,
      readStates,
      // starredItems
    ] = await Promise.all([
      fetchUserPrivateChannels(),
      fetchMe(),
      fetchUserChannelsReadStates(),
      // fetchStarredItems(),
      fetchBlockedUsers(),
    ]);

    const me = parseUser(rawMe);
    const channels = rawChannels.map((c) => ({
      ...c,
      memberUserIds: c.memberUserIds == null ? [me.id] : c.memberUserIds,
    }));

    // TODO: Change this
    // const missingChannelStars = starredItems.filter(
    //   (i) =>
    //     i.type === "channel" && rawChannels.every((c) => c.id !== i.reference)
    // );

    // if (missingChannelStars.length !== 0)
    //   await Promise.all(
    //     missingChannelStars.map((s) =>
    //       fetchChannel(s.reference).catch((e) => {
    //         // 403 may happen if you have starred a channel you no longer have access to
    //         if (e.code !== 403 && e.code !== 404) throw e;
    //       })
    //     )
    //   );

    fetchPreferences();

    const dmChannelIds = unique(
      channels.filter((c) => c.kind === "dm").map((c) => c.id)
    );
    for (const id of dmChannelIds) fetchChannelMembers(id);

    dispatch({
      type: "fetch-client-boot-data-request-successful",
      user: me,
      channels,
      readStates,
      // starredItems,
    });

    return { user: me, channels, readStates };
  };

  return {
    logout() {
      authTokenStore.clear();
      cacheStore.clear();
      dispatch({ type: "logout" });
    },
    fetchMe,
    updateMe,
    deleteMe() {
      return authorizedFetch("/users/me", { method: "DELETE" });
    },
    fetchBlockedUsers,
    fetchPreferences,
    async setChannelNotificationSetting(channelId, setting) {
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
    },
    async registerDevicePushToken(token) {
      const me = await fetchMe();
      return updateMe({ pushTokens: unique([...me.pushTokens, token]) });
    },
    async fetchUser({ accountAddress }) {
      const rawUsers = await authorizedFetch("/users/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_addresses: [accountAddress] }),
        allowUnauthorized: true,
      });
      const users = rawUsers.map(parseUser);
      dispatch({ type: "fetch-users-request-successful", users });
      return users[0];
    },
    fetchUsers,
    fetchMessages(
      channelId,
      { limit = 50, beforeMessageId, afterMessageId, onSuccess } = {}
    ) {
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
        (rawMessages) => {
          const messages = rawMessages.map(parseMessage);

          onSuccess?.();
          dispatch({
            type: "fetch-messages:request-successful",
            channelId,
            limit,
            beforeMessageId,
            afterMessageId,
            messages,
          });

          const fetchMessage = (messageId) =>
            authorizedFetch(`/channels/${channelId}/messages/${messageId}`, {
              allowUnauthorized: true,
            }).then((rawMessage) =>
              rawMessage == null
                ? {
                    id: messageId,
                    channelId,
                    deleted: true,
                  }
                : parseMessage(rawMessage)
            );

          const fetchReplyTargetChain = (messageId, prevChain = []) =>
            fetchMessage(messageId).then((message) => {
              const chain = [...prevChain, message];
              if (message.replyTargetMessageId == null) return chain;
              return fetchReplyTargetChain(message.replyTargetMessageId, chain);
            });

          const fetchReplyTargets = async () => {
            const replies = messages.filter(
              (m) => m.replyTargetMessageId != null
            );
            const responses = await Promise.all(
              replies.map((m) => fetchReplyTargetChain(m.replyTargetMessageId))
            );
            const allMessages = responses.flatMap((ms) => ms);
            dispatch({
              type: "fetch-messages:request-successful",
              messages: allMessages,
              channelId,
            });
          };

          // Fetch all messages replied to async. Works for now!
          fetchReplyTargets();

          const messageUserIds = unique([
            ...messages
              .filter((m) => m.type === "regular" || m.type === "user-invited")
              .flatMap((m) =>
                [m.authorUserId, m.inviterUserId].filter(Boolean)
              ),
            ...messages
              .flatMap((m) => getMentions(m.content))
              .map((m) => m.ref),
          ]);

          const cachedUserIds = Object.keys(getStoreState().users.entriesById);

          const missingUserIds = messageUserIds.filter(
            (id) => !cachedUserIds.includes(id)
          );

          // Beautifuly fetch missing users
          if (authStatus === "authenticated") fetchUsers(missingUserIds);
          else
            dispatch({
              type: "register-unknown-users",
              userIds: missingUserIds,
            });

          return messages;
        }
      );
    },
    markChannelRead,
    fetchMessage(id) {
      return authorizedFetch(`/messages/${id}`).then((rawMessage) => {
        const message = parseMessage(rawMessage);
        dispatch({
          type: "fetch-message:request-successful",
          message,
        });
        return message;
      });
    },
    async fetchLastChannelMessage(channelId) {
      const [message] = await authorizedFetch(
        `/channels/${channelId}/messages?limit=1`,
        { allowUnauthorized: true }
      ).then((ms) => ms.map(parseMessage));

      if (message == null) return null;

      if (message.replyTargetMessageId == null) {
        dispatch({
          type: "fetch-message:request-successful",
          message,
        });
        return message;
      }

      const fetchLastNonReplyBeforeMessage = async (messageId) => {
        const [message] = await authorizedFetch(
          `/channels/${channelId}/messages?limit=1&before=${messageId}`,
          { allowUnauthorized: true }
        ).then((ms) => ms.map(parseMessage));
        if (message.replyTargetMessageId == null) return message;
        return fetchLastNonReplyBeforeMessage(message.id);
      };

      const lastNonReply = await fetchLastNonReplyBeforeMessage(message.id);

      dispatch({
        type: "fetch-message:request-successful",
        message: lastNonReply,
      });

      return lastNonReply;
    },
    async createMessage(
      { channel: channelId, blocks, replyToMessageId: replyTargetMessageId },
      { optimistic = true } = {}
    ) {
      const me = selectMe(getStoreState());
      const stringContent = stringifyMessageBlocks(blocks, {
        humanReadable: false,
      });

      // TODO: Less hacky optimistc UI
      const dummyId = generateDummyId();

      if (optimistic) {
        dispatch({
          type: "create-message:request-sent",
          message: {
            id: dummyId,
            type: "regular",
            createdAt: new Date().toISOString(),
            content: blocks,
            stringContent,
            authorId: me.id,
            authorUserId: me.id,
            channelId,
            replyTargetMessageId,
          },
        });
      }

      return authorizedFetch("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: channelId,
          blocks,
          content: stringContent,
          reply_to: replyTargetMessageId,
        }),
      }).then(
        (rawMessage) => {
          const message = parseMessage(rawMessage);
          dispatch({
            type: "create-message:request-successful",
            message,
            optimisticEntryId: dummyId,
          });
          markChannelRead(message.channelId, {
            readAt: new Date(message.createdAt),
          });
          return message;
        },
        (error) => {
          dispatch({
            type: "create-message:request-failed",
            error,
            channelId,
            optimisticEntryId: dummyId,
          });
          return Promise.reject(error);
        }
      );
    },
    updateMessage(messageId, { blocks }) {
      return authorizedFetch(`/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks,
          content: stringifyMessageBlocks(blocks, { humanReadable: false }),
        }),
      }).then((rawMessage) => {
        const message = parseMessage(rawMessage);
        dispatch({
          type: "message-update-request-successful",
          message,
        });
        return rawMessage;
      });
    },
    removeMessage(messageId) {
      return authorizedFetch(`/messages/${messageId}`, {
        method: "DELETE",
      }).then((message) => {
        dispatch({ type: "message-delete-request-successful", messageId });
        return message;
      });
    },
    reportMessage(messageId, { comment }) {
      return authorizedFetch(`/messages/${messageId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment, reason: "other" }),
      });
    },
    addMessageReaction(messageId, { emoji }) {
      invariant(isEmoji(emoji), "Only emojis allowed");

      const me = selectMe(getStoreState());

      dispatch({
        type: "add-message-reaction:request-sent",
        messageId,
        emoji,
        userId: me.id,
      });

      // TODO: Extract recent emoji cache into its own thing
      if (cacheStore != null) {
        cacheStore.readAsync("recent-emoji").then((cachedEmoji) => {
          cacheStore.write(
            "recent-emoji",
            cachedEmoji == null
              ? [emoji]
              : [emoji, ...cachedEmoji.filter((e) => e !== emoji)].slice(0, 100)
          );
        });
      }

      // TODO: Undo the optimistic update if the request fails
      return authorizedFetch(
        `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        { method: "POST" }
      );
    },
    removeMessageReaction(messageId, { emoji }) {
      const me = selectMe(getStoreState());

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
    },
    fetchChannel,
    fetchUserChannels,
    fetchUserPrivateChannels,
    fetchPubliclyReadableChannels() {
      return authorizedFetch("/channels/@public", {
        allowUnauthorized: true,
      }).then((rawChannels) => {
        const channels = rawChannels.map(parseChannel);
        dispatch({
          type: "fetch-publicly-readable-channels-request-successful",
          channels,
        });
        return channels;
      });
    },
    fetchUserMessages(userId) {
      return authorizedFetch(`/users/${userId}/messages`).then(
        (rawMessages) => {
          const messages = rawMessages.map(parseMessage);
          dispatch({ type: "fetch-messages:request-successful", messages });
          return messages;
        }
      );
    },
    fetchUserChannelsReadStates,
    createChannel,
    createDmChannel({ name, memberUserIds, memberWalletAddresses }) {
      return authorizedFetch("/channels", {
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
      });
    },
    createOpenChannel({ name, description, body }) {
      return createChannel({
        name,
        description,
        body,
        permissionOverwrites: openChannelPermissionOverrides,
      });
    },
    createClosedChannel({
      name,
      description,
      body,
      memberWalletAddresses,
      memberUserIds,
    }) {
      return createChannel({
        name,
        description,
        body,
        memberWalletAddresses,
        memberUserIds,
        permissionOverwrites: closedChannelPermissionOverrides,
      });
    },
    createPrivateChannel({
      name,
      description,
      body,
      memberUserIds,
      memberWalletAddresses,
    }) {
      return createChannel({
        name,
        description,
        body,
        memberWalletAddresses,
        memberUserIds,
        permissionOverwrites: privateChannelPermissionOverrides,
      });
    },
    fetchChannelMembers,
    fetchChannelPermissions,
    fetchChannelPublicPermissions,
    addChannelMember(channelId, walletAddressOrUserId) {
      return authorizedFetch(`/channels/${channelId}/invite`, {
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
      });
    },
    removeChannelMember(channelId, userId) {
      return authorizedFetch(`/channels/${channelId}/members/${userId}`, {
        method: "DELETE",
      }).then((res) => {
        // TODO
        fetchChannelMembers(channelId);
        // fetchInitialData();
        return res;
      });
    },
    joinChannel(channelId) {
      return authorizedFetch(`/channels/${channelId}/join`, {
        method: "POST",
      }).then((res) => {
        // TODO
        fetchChannel(channelId);
        fetchChannelMembers(channelId);
        // fetchInitialData();
        return res;
      });
    },
    leaveChannel(channelId) {
      const me = selectMe(getStoreState());

      dispatch({
        type: "leave-channel:request-sent",
        channelId,
        userId: me.id,
      });

      return authorizedFetch(`/channels/${channelId}/members/me`, {
        method: "DELETE",
      }).then((res) => {
        // TODO
        fetchChannelMembers(channelId);
        // fetchInitialData();
        return res;
      });
    },
    updateChannel(id, { name, description, avatar, body }) {
      return authorizedFetch(`/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanString(name),
          description: cleanString(description),
          avatar: cleanString(avatar),
          body,
        }),
      }).then((res) => {
        // TODO
        fetchChannel(id);
        // fetchInitialData();
        return res;
      });
    },
    deleteChannel(id) {
      authorizedFetch(`/channels/${id}`, { method: "DELETE" }).then((res) => {
        dispatch({ type: "delete-channel-request-successful", id });
        return res;
      });
    },
    updateChannelPermissions,
    makeChannelOpen(channelId) {
      return updateChannelPermissions(
        channelId,
        openChannelPermissionOverrides
      );
    },
    makeChannelClosed(channelId) {
      return updateChannelPermissions(
        channelId,
        closedChannelPermissionOverrides
      );
    },
    makeChannelPrivate(channelId) {
      updateChannelPermissions(channelId, privateChannelPermissionOverrides);
    },
    fetchStarredItems,
    fetchApps() {
      return authorizedFetch("/apps", {
        allowUnauthorized: true,
        priority: "low",
      }).then((res) => {
        dispatch({ type: "fetch-apps-request-successful", apps: res });
        return res;
      });
    },
    fetchClientBootData(mode = "full") {
      switch (mode) {
        case "full":
          return fetchClientBootDataFull();
        case "private-only":
          return fetchClientBootDataPrivate();
        default:
          throw new Error(`Unrecognized boot mode "${mode}"`);
      }
    },
    starChannel(channelId) {
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
    },
    unstarChannel(channelId) {
      const starId = selectChannelStarId(getStoreState(), channelId);
      dispatch({ type: "unstar-channel:request-sent", channelId });
      return unstarItem(starId).then((res) => {
        dispatch({ type: "unstar-channel:request-successful", channelId });
        return res;
      });
    },
    starUser(userId) {
      return starItem({ type: "user", reference: userId }).then((res) => {
        dispatch({
          type: "star-user:request-successful",
          userId,
          star: { id: res.id },
        });
        return res;
      });
    },
    unstarUser(userId) {
      const starId = selectUserStarId(getStoreState(), userId);
      return unstarItem(starId).then((res) => {
        dispatch({ type: "unstar-user:request-successful", userId });
        return res;
      });
    },
    reportUser(userId, { comment }) {
      return authorizedFetch("/users/me/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: userId, reason: "other", comment }),
      });
    },
    async blockUser(userId) {
      await authorizedFetch("/users/me/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: userId }),
      });
      await fetchBlockedUsers();
    },
    async unblockUser(userId) {
      await authorizedFetch(`/users/me/blocks/${userId}`, { method: "DELETE" });
      await fetchBlockedUsers();
    },
    uploadImage({ files }) {
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
    },
    uploadImageWithUrl(url) {
      return authorizedFetch("/media/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }).then(({ id }) => ({
        url: buildCloudflareImageUrl(id, { size: "large" }),
      }));
    },
    registerChannelTypingActivity(channelId) {
      return authorizedFetch(`/channels/${channelId}/typing`, {
        method: "POST",
      });
    },
    searchGifs(query) {
      return authorizedFetch(`/integrations/tenor/search?q=${query}`);
    },
    promptDalle(prompt) {
      return authorizedFetch(
        `/integrations/dalle/generate?prompt=${encodeURIComponent(prompt)}`,
        { method: "POST" }
      );
    },
    promptChatGPT(prompt) {
      return authorizedFetch(
        `/integrations/chatgpt?message=${encodeURIComponent(prompt)}`,
        { method: "POST" }
      );
    },
    // This assumes the client is batching request
    async fetchEnsData(
      accountAddresses,
      { publicEthereumClient, avatars = true }
    ) {
      const namesByAddress = Object.fromEntries(
        (
          await Promise.all(
            accountAddresses.map((address) =>
              publicEthereumClient
                .getEnsName({ address })
                .then((name) => (name == null ? null : [address, name]))
            )
          )
        ).filter(Boolean)
      );

      const avatarsByAddress = avatars
        ? Object.fromEntries(
            (
              await Promise.all(
                Object.entries(namesByAddress).map(([address, name]) =>
                  publicEthereumClient
                    .getEnsAvatar({ name })
                    .then((avatar) =>
                      avatar == null ? null : [address, avatar]
                    )
                )
              )
            ).filter(Boolean)
          )
        : {};

      const entriesByAddress = Object.fromEntries(
        Object.entries(namesByAddress).map(([address, name]) => [
          address,
          { name, avatar: avatarsByAddress[address] },
        ])
      );

      dispatch({
        type: "fetch-ens-entries:request-successful",
        entriesByAddress,
      });

      return entriesByAddress;
    },
  };
};
