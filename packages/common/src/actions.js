import { generateDummyId } from "./utils/misc.js";
import { unique } from "./utils/array.js";
import invariant from "./utils/invariant.js";
import {
  stringifyBlocks as stringifyMessageBlocks,
  getMentions,
} from "./utils/message.js";
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

export default ({
  api,
  dispatch,
  authStatus,
  getStoreState,
  cacheStore,
  setAuthenticationData,
}) => {
  const fetchMe = () =>
    api.fetchMe().then((user) => {
      dispatch({ type: "fetch-me-request-successful", user });
      return user;
    });

  const updateMe = ({ displayName, description, profilePicture, pushTokens }) =>
    api
      .updateMe({ displayName, description, profilePicture, pushTokens })
      .then((user) => {
        dispatch({ type: "update-me:request-successful", user });
        return user;
      });

  const fetchUsers = (userIds) =>
    api.fetchUsers(userIds).then((users) => {
      dispatch({ type: "fetch-users-request-successful", users });
      return users;
    });

  const fetchUserChannels = (accountAddress) =>
    api.fetchUserChannels(accountAddress).then((channels) => {
      dispatch({ type: "fetch-user-channels-request-successful", channels });
      return channels;
    });

  const fetchUserChannelsReadStates = () =>
    api.fetchUserChannelsReadStates().then((readStates) => {
      dispatch({
        type: "fetch-user-channels-read-states-request-successful",
        readStates,
      });
      return readStates;
    });

  const fetchChannel = (id) =>
    api.fetchChannel(id).then((channel) => {
      dispatch({ type: "fetch-channel-request-successful", channel });
      return channel;
    });

  const createChannel = ({
    name,
    description,
    body,
    tags,
    memberUserIds,
    memberWalletAddresses,
    permissionOverwrites,
  }) =>
    api
      .createChannel({
        name,
        description,
        body,
        tags,
        memberUserIds,
        memberWalletAddresses,
        permissionOverwrites,
      })
      .then((channel) => {
        // TODO
        // dispatch({ type: "create-channel:request-successful", channel });
        fetchUserChannels();
        return channel;
      });

  const fetchChannelMembers = (channelId) =>
    api.fetchChannelMembers(channelId).then((users) => {
      dispatch({
        type: "fetch-channel-members-request-successful",
        channelId,
        members: users,
      });
      return users;
    });

  const fetchChannelPermissions = (channelId) =>
    api.fetchChannelPermissions(channelId).then((res) => {
      dispatch({
        type: "fetch-channel-permissions:request-successful",
        channelId,
        permissions: res,
      });
      return res;
    });

  const fetchUserPrivateChannels = () =>
    api.fetchUserPrivateChannels().then((channels) => {
      // TODO handle this action
      dispatch({ type: "fetch-channels-request-successful", channels });
      return channels;
    });

  const fetchChannelPublicPermissions = (channelId) =>
    api.fetchChannelPublicPermissions(channelId).then((res) => {
      dispatch({
        type: "fetch-channel-public-permissions-request-successful",
        channelId,
        permissions: res,
      });
      return res;
    });

  const markChannelRead = (channelId) => {
    const lastMessageAt = selectChannelLastMessageAt(
      getStoreState(),
      channelId,
    );

    // Use the current time in case the channel is empty
    const readAt = lastMessageAt == null ? new Date() : lastMessageAt;

    // TODO: Undo if request fails
    dispatch({ type: "mark-channel-read:request-sent", channelId, readAt });

    return api.markChannelReadAt(channelId, { readAt });
  };

  const updateChannelPermissions = (channelId, permissions) =>
    api.updateChannelPermissions(channelId, permissions).then((res) => {
      // TODO permissions?
      fetchChannelPermissions(channelId);
      fetchChannelPublicPermissions(channelId);
      // fetchInitialData();
      return res;
    });

  const fetchStarredItems = () =>
    api.fetchStarredItems().then((stars) => {
      dispatch({ type: "fetch-starred-items:request-successful", stars });
      return stars;
    });

  const fetchBlockedUsers = async () => {
    const userIds = await api.fetchBlockedUsers();
    dispatch({ type: "fetch-blocked-users:request-successful", userIds });
    return userIds;
  };

  const fetchPreferences = () =>
    api.fetchPreferences().then(({ notificationSettingsByChannelId }) => {
      dispatch({
        type: "fetch-preferences:request-successful",
        notificationSettingsByChannelId,
      });

      return { notificationSettingsByChannelId };
    });

  const starItem = ({ type, reference }) => api.starItem({ type, reference });

  const unstarItem = (starId) => api.unstarItem(starId);

  const fetchClientBootDataFull = () =>
    api
      .fetchClientBootDataFull()
      .then(
        ({
          user: me,
          channels,
          readStates,
          apps,
          starredItems,
          blockedUserIds,
        }) => {
          dispatch({
            type: "fetch-client-boot-data-request-successful",
            user: me,
            channels,
            readStates,
            apps,
            // starredItems,
          });

          // TODO
          dispatch({
            type: "fetch-starred-items:request-successful",
            stars: starredItems,
          });

          // TODO
          dispatch({
            type: "fetch-blocked-users:request-successful",
            userIds: blockedUserIds,
          });

          return { user: me, channels, readStates, starredItems };
        },
      );

  const fetchClientBootDataPrivate = () =>
    api
      .fetchClientBootDataPrivate()
      .then(({ user: me, channels, readStates, blockedUserIds }) => {
        dispatch({
          type: "fetch-client-boot-data-request-successful",
          user: me,
          channels,
          readStates,
          // starredItems,
        });

        // TODO
        dispatch({
          type: "fetch-blocked-users:request-successful",
          userIds: blockedUserIds,
        });

        return { user: me, channels, readStates };
      });

  return {
    async login({
      message,
      signature,
      address,
      signedAt,
      nonce,
      accessToken,
      refreshToken,
    }) {
      const authenticationData = await api.authenticate({
        message,
        signature,
        address,
        signedAt,
        nonce,
        accessToken,
        refreshToken,
      });
      setAuthenticationData(authenticationData);
    },
    logout() {
      setAuthenticationData(null);
      cacheStore.clear();
      dispatch({ type: "logout" });
    },
    fetchMe,
    updateMe,
    deleteMe() {
      return api.deleteMe();
    },
    fetchBlockedUsers,
    fetchPreferences,
    async setChannelNotificationSetting(channelId, setting) {
      dispatch({
        type: "set-channel-notification-setting:request-sent",
        channelId,
        setting,
      });
      return api.setChannelNotificationSetting(channelId, setting);
    },
    async registerDevicePushToken(token) {
      const me = await fetchMe();
      return updateMe({ pushTokens: unique([...me.pushTokens, token]) });
    },
    async fetchUser({ accountAddress }) {
      const user = await api.fetchUser({ accountAddress });
      dispatch({ type: "fetch-users-request-successful", users: [user] });
      return user;
    },
    fetchUsers,
    fetchMessages(
      channelId,
      { limit = 50, beforeMessageId, afterMessageId, onSuccess } = {},
    ) {
      return api
        .fetchMessages(channelId, { limit, beforeMessageId, afterMessageId })
        .then((messages) => {
          onSuccess?.();
          dispatch({
            type: "fetch-messages:request-successful",
            channelId,
            limit,
            beforeMessageId,
            afterMessageId,
            messages,
          });

          const fetchReplyTargetChain = (messageId, prevChain = []) =>
            api.fetchChannelMessage(channelId, messageId).then((message) => {
              const chain = [...prevChain, message];
              if (message.replyTargetMessageId == null) return chain;
              return fetchReplyTargetChain(message.replyTargetMessageId, chain);
            });

          const fetchReplyTargets = async () => {
            const replies = messages.filter(
              (m) => m.replyTargetMessageId != null,
            );
            const responses = await Promise.all(
              replies.map((m) => fetchReplyTargetChain(m.replyTargetMessageId)),
            );
            const allMessages = responses.flatMap((ms) => ms);
            dispatch({
              type: "fetch-reply-target-messages:request-successful",
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
                [m.authorUserId, m.inviterUserId].filter(Boolean),
              ),
            ...messages
              .flatMap((m) => getMentions(m.content))
              .map((m) => m.ref),
          ]);

          const cachedUserIds = Object.keys(getStoreState().users.entriesById);

          const missingUserIds = messageUserIds.filter(
            (id) => !cachedUserIds.includes(id),
          );

          // Beautifuly fetch missing users
          if (authStatus === "authenticated") fetchUsers(missingUserIds);
          else
            dispatch({
              type: "register-unknown-users",
              userIds: missingUserIds,
            });

          return messages;
        });
    },
    markChannelRead,
    fetchMessage(id) {
      return api.fetchMessage(id).then((message) => {
        dispatch({
          type: "fetch-message:request-successful",
          message,
        });
        return message;
      });
    },
    async fetchLastChannelMessage(channelId) {
      const message = await api.fetchLastChannelMessage(channelId);

      if (message == null) return null;

      dispatch({
        type: "fetch-message:request-successful",
        message,
      });

      return message;
    },
    async createMessage(
      { channel: channelId, blocks, replyToMessageId: replyTargetMessageId },
      { optimistic = true } = {},
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

      return api
        .createChannelMessage(channelId, {
          blocks,
          stringContent,
          replyTargetMessageId,
        })
        .then(
          (message) => {
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
          },
        );
    },
    async updateMessage(messageId, { blocks }) {
      const message = await api.updateMessage(messageId, { blocks });
      dispatch({
        type: "message-update-request-successful",
        message,
      });
      return message;
    },
    async removeMessage(messageId) {
      const message = api.removeMessage(messageId);
      dispatch({ type: "message-delete-request-successful", messageId });
      return message;
    },
    reportMessage(messageId, { comment }) {
      return api.reportMessage(messageId, { comment });
    },
    addMessageReaction(messageId, { emoji }) {
      invariant(emoji != null, "Emoji missing");
      // invariant(isEmoji(emoji), "Only emojis allowed");

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
              : [emoji, ...cachedEmoji.filter((e) => e !== emoji)].slice(
                  0,
                  100,
                ),
          );
        });
      }

      // TODO: Undo the optimistic update if the request fails
      return api.addMessageReaction(messageId, { emoji });
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
      return api.removeMessageReaction(messageId, { emoji });
    },
    fetchChannel,
    fetchUserChannels,
    fetchUserPrivateChannels,
    async fetchPubliclyReadableChannels(query) {
      const channels = await api.fetchPubliclyReadableChannels(query);
      dispatch({
        type: "fetch-publicly-readable-channels-request-successful",
        channels,
      });
      return channels;
    },
    async fetchUserMessages(userId) {
      const messages = await api.fetchUserMessages(userId);
      dispatch({ type: "fetch-user-messages:request-successful", messages });
      return messages;
    },
    fetchUserChannelsReadStates,
    createChannel,
    async createDmChannel({ name, memberUserIds, memberWalletAddresses }) {
      const channel = await api.createDmChannel({
        name,
        memberUserIds,
        memberWalletAddresses,
      });

      // TODO: dispatch instead
      fetchUserChannels();
      return channel;
    },
    createOpenChannel({ name, description, body, tags }) {
      return createChannel({
        name,
        description,
        body,
        tags,
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
    async addChannelMember(channelId, walletAddressOrUserId) {
      await api.addChannelMember(channelId, walletAddressOrUserId);
      // TODO: dispatch instead
      fetchChannelMembers(channelId);
    },
    async removeChannelMember(channelId, userId) {
      await api.removeChannelMember(channelId, userId);
      // TODO: dispatch instead
      fetchChannelMembers(channelId);
    },
    async joinChannel(channelId) {
      await api.joinChannel(channelId);
      // TODO: dispatch instead
      fetchChannel(channelId);
      fetchChannelMembers(channelId);
    },
    async leaveChannel(channelId) {
      const me = selectMe(getStoreState());

      dispatch({
        type: "leave-channel:request-sent",
        channelId,
        userId: me.id,
      });

      await api.leaveChannel(channelId);
      // TODO: dispatch instead
      fetchChannelMembers(channelId);
    },
    async updateChannel(channelId, { name, description, avatar, body }) {
      const channel = await api.updateChannel(channelId, {
        name,
        description,
        avatar,
        body,
      });
      // TODO: dispatch instead
      fetchChannel(channelId);
      return channel;
    },
    async deleteChannel(id) {
      await api.deleteChannel(id);
      dispatch({ type: "delete-channel-request-successful", id });
    },
    updateChannelPermissions,
    makeChannelOpen(channelId) {
      return updateChannelPermissions(
        channelId,
        openChannelPermissionOverrides,
      );
    },
    makeChannelClosed(channelId) {
      return updateChannelPermissions(
        channelId,
        closedChannelPermissionOverrides,
      );
    },
    makeChannelPrivate(channelId) {
      updateChannelPermissions(channelId, privateChannelPermissionOverrides);
    },
    fetchStarredItems,
    async fetchApps() {
      const apps = await api.fetchApps();
      dispatch({ type: "fetch-apps-request-successful", apps });
      return apps;
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
      return api.reportUser(userId, { comment });
    },
    async blockUser(userId) {
      await api.blockUser(userId);
      // TODO: dispatch instead
      await fetchBlockedUsers();
    },
    async unblockUser(userId) {
      await api.unblockUser(userId);
      // TODO: dispatch instead
      await fetchBlockedUsers();
    },
    uploadImage({ files }) {
      return api.uploadImage({ files });
    },
    uploadImageWithUrl(url) {
      return api.uploadImageWithUrl(url);
    },
    registerChannelTypingActivity(channelId) {
      return api.registerChannelTypingActivity(channelId);
    },
    searchGifs(query) {
      return api.searchGifs(query);
    },
    promptDalle(prompt) {
      return api.promptDalle(prompt);
    },
    promptChatGPT(prompt) {
      return api.promptChatGPT(prompt);
    },
    // This assumes the client is batching request
    async fetchEnsData(
      accountAddresses,
      { publicEthereumClient, avatars = true },
    ) {
      const namesByAddress = Object.fromEntries(
        (
          await Promise.all(
            accountAddresses.map((address) =>
              publicEthereumClient
                .getEnsName({ address })
                .then((name) => (name == null ? null : [address, name])),
            ),
          )
        ).filter(Boolean),
      );

      const avatarsByAddress = avatars
        ? Object.fromEntries(
            (
              await Promise.all(
                Object.entries(namesByAddress).map(([address, name]) =>
                  publicEthereumClient
                    .getEnsAvatar({ name })
                    .then((avatar) =>
                      avatar == null ? null : [address, avatar],
                    ),
                ),
              )
            ).filter(Boolean),
          )
        : {};

      const entriesByAddress = Object.fromEntries(
        Object.entries(namesByAddress).map(([address, name]) => [
          address.toLowerCase(),
          { name, avatar: avatarsByAddress[address] },
        ]),
      );

      dispatch({
        type: "fetch-ens-entries:request-successful",
        entriesByAddress,
      });

      return entriesByAddress;
    },
  };
};
