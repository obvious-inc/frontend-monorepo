import { mapValues, pickKeys } from "../utils/object.js";
import { create as createLock } from "../utils/locks.js";
import {
  parseString as parseStringToMessageBlocks,
  stringifyBlocks as stringifyMessageBlocks,
} from "../utils/message.js";

const ACCESS_TOKEN_CACHE_KEY = "access-token";
const REFRESH_TOKEN_CACHE_KEY = "refresh-token";

const listeners = new Set();

const requestAccessTokenRefreshLock = createLock("ns:access-token-refresh");

const isTruncatedAddress = (s) =>
  typeof s === "string" && s.startsWith("0x") && s.includes("...");

const cleanString = (s) => {
  if (typeof s !== "string") return s;
  return s.trim() === "" ? null : s.trim();
};

const createParsers = ({ buildCloudflareImageUrl }) => ({
  parseUser(u) {
    if (u.id == null) throw new Error();

    const normalizeString = (maybeString) => {
      if (maybeString == null || maybeString.trim() === "") return null;
      return maybeString.trim();
    };

    const createProfilePicture = () => {
      if (u.pfp == null) return null;

      if (normalizeString(u.pfp.cf_id) == null)
        return {
          small: u.pfp.input_image_url,
          large: u.pfp.input_image_url,
        };

      return {
        small: buildCloudflareImageUrl(u.pfp.cf_id, { size: "small" }),
        large: buildCloudflareImageUrl(u.pfp.cf_id, { size: "large" }),
        isVerified: u.pfp.verified,
      };
    };

    const parsedData = { id: u.id };

    // Static ish
    if (u.wallet_address != null) parsedData.walletAddress = u.wallet_address;
    if (u.push_tokens != null) parsedData.pushTokens = u.push_tokens;
    if (u.created_at != null) parsedData.createdAt = u.created_at;

    if (u.display_name !== undefined && !isTruncatedAddress(u.display_name))
      parsedData.displayName = normalizeString(u.display_name);

    if (u.description !== undefined)
      parsedData.description = normalizeString(u.description);

    if (u.status !== undefined) parsedData.status = normalizeString(u.status);

    if (u.pfp !== undefined) parsedData.profilePicture = createProfilePicture();

    return parsedData;
  },
  parseChannel(rawChannel) {
    if (rawChannel.id == null) throw new Error();

    const normalizeString = (s) => {
      if (s == null) return null;
      return s.trim() === "" ? null : s;
    };

    const description = normalizeString(rawChannel.description);
    const body =
      rawChannel.body == null || rawChannel.body.length === 0
        ? null
        : rawChannel.body;

    const channel = {
      id: rawChannel.id,
      name: normalizeString(rawChannel.name),
      description,
      descriptionBlocks:
        description != null
          ? parseStringToMessageBlocks(description)
          : body != null
            ? body
            : null,
      body,
      kind: rawChannel.kind,
      createdAt: rawChannel.created_at,
      lastMessageAt: rawChannel.last_message_at,
      tags: rawChannel.tags,
      memberUserIds:
        rawChannel.members == null
          ? undefined
          : rawChannel.members.map((m) => (typeof m === "string" ? m : m.user)),
      ownerUserId: rawChannel.owner,
      isDeleted: rawChannel.deleted,
    };

    if (rawChannel.tags != null) channel.tags = rawChannel.tags;

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
  parseMessage(rawMessage) {
    if (rawMessage.id == null) throw new Error();

    if (rawMessage.deleted) return { id: rawMessage.id, deleted: true };

    const systemMessageTypes = [
      "member-joined",
      "user-invited",
      "channel-updated",
      "app-installed",
    ];

    const appMessageTypes = ["webhook", "app"];

    const deriveMessageType = (message) => {
      switch (message.type) {
        case undefined:
        case 0:
          return "regular";
        case 1:
          if (message.inviter) return "user-invited";
          return "member-joined";
        case 2:
        case 3:
          return "webhook";
        case 5:
          return "channel-updated";
        case 6:
          return "app-installed";
        default:
          console.warn(`Unknown message type "${message.type}"`);
      }
    };

    const type = deriveMessageType(rawMessage);

    const isSystemMessage = systemMessageTypes.includes(type);
    const isAppMessage = appMessageTypes.includes(type);

    const appId = rawMessage.app;
    const authorUserId = rawMessage.author;

    const content =
      rawMessage.blocks?.length > 0
        ? rawMessage.blocks
        : [{ type: "paragraph", children: [{ text: rawMessage.content }] }];

    const authorId = isSystemMessage
      ? "system"
      : isAppMessage
        ? appId
        : authorUserId;

    return {
      id: rawMessage.id,
      deleted: rawMessage.deleted,
      createdAt: rawMessage.created_at,
      channelId: rawMessage.channel,
      authorUserId,
      authorId,
      isEdited: rawMessage.edited_at != null,
      type,
      isSystemMessage,
      isAppMessage,
      installerUserId: rawMessage.installer,
      inviterUserId: rawMessage.inviter,
      content,
      stringContent: rawMessage.content,
      embeds: rawMessage.embeds,
      reactions: rawMessage.reactions,
      appId,
      replyTargetMessageId: rawMessage.reply_to,
      isReply: rawMessage.reply_to != null,
      updates: rawMessage.updates,
    };
  },
});

const serverEventMap = {
  MESSAGE_CREATE: "message-created",
  MESSAGE_UPDATE: "message-updated",
  MESSAGE_REMOVE: "message-removed",
  MESSAGE_REACTION_ADD: "message-reaction-added",
  MESSAGE_REACTION_REMOVE: "message-reaction-removed",
  USER_PROFILE_UPDATE: "user-profile-updated",
  USER_PRESENCE_UPDATE: "user-presence-updated",
  USER_TYPING: "user-typed",
  CHANNEL_READ: "channel-read",
  CHANNEL_UPDATE: "channel-updated",
  CHANNEL_USER_JOINED: "channel-user-joined",
  CHANNEL_USER_INVITED: "channel-user-invited",
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

const emit = (eventName, payload) => {
  for (const listener of listeners) listener(eventName, payload);
};

export default ({
  apiOrigin,
  cloudflareAccountHash,
  cacheStore,
  Pusher,
  pusherKey,
}) => {
  const buildCloudflareImageUrl = (cloudflareId, { size } = {}) => {
    const variantNameBySizeName = { small: "avatar", large: "public" };
    const variant = variantNameBySizeName[size];
    if (variant == null) throw new Error();
    return `https://imagedelivery.net/${cloudflareAccountHash}/${cloudflareId}/${variant}`;
  };

  const parsers = createParsers({ buildCloudflareImageUrl });
  const { parseUser, parseChannel, parseMessage } = parsers;

  const parseServerEvent = (rawEventName, data) => {
    const name = serverEventMap[rawEventName];

    const finalizeServerEvent = (customData) => {
      const eventName = ["server-event", name].join(":");
      return [eventName, { ...data, ...customData }];
    };

    switch (name) {
      case "channel-updated":
      case "channel-user":
        return finalizeServerEvent({ channel: parseChannel(data.channel) });

      case "user-typed":
        return finalizeServerEvent({
          userId: data.user.id,
          channelId: data.channel.id,
        });

      case "user-profile-updated":
      case "user-presence-updated":
      case "channel-user-joined":
        return finalizeServerEvent({ user: parseUser(data.user) });

      case "message-created":
      case "message-updated":
      case "message-removed":
      case "message-reaction-added":
      case "message-reaction-removed":
        return finalizeServerEvent({ message: parseMessage(data.message) });

      case "channel-user-invited":
        return finalizeServerEvent({
          user: parseUser(data.user),
          channel: parseChannel(data.channel),
        });

      default:
        return finalizeServerEvent();
    }
  };

  const refreshAccessToken = async (refreshToken) => {
    const response = await fetch(`${apiOrigin}/auth/refresh`, {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      const body = await response.json();
      return {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
      };
    }

    if (response.status === 401)
      return Promise.reject(new Error("refresh-token-expired"));

    return Promise.reject(new Error(response.statusText));
  };

  const refreshAccessTokenWithLock = async (refreshToken) => {
    const lock = requestAccessTokenRefreshLock();

    if (lock != null) await lock;

    return requestAccessTokenRefreshLock(async () => {
      const cachedRefreshToken = await cacheStore.read(REFRESH_TOKEN_CACHE_KEY);

      // Prevents race conditions where a refresh happened when we were waiting
      // for the lock to release
      if (refreshToken !== cachedRefreshToken) return;

      const tokens = await refreshAccessToken(refreshToken);
      await Promise.all([
        cacheStore.write(ACCESS_TOKEN_CACHE_KEY, tokens.accessToken),
        cacheStore.write(REFRESH_TOKEN_CACHE_KEY, tokens.refreshToken),
      ]);
    });
  };

  const authorizedFetch = async (url, options) => {
    const requireAccessToken =
      !options?.allowUnauthorized && !options?.unauthorized;

    if (requireAccessToken) {
      const lock = requestAccessTokenRefreshLock();
      if (lock != null) await lock;
    }

    const [accessToken, refreshToken] = await Promise.all([
      cacheStore.read(ACCESS_TOKEN_CACHE_KEY),
      cacheStore.read(REFRESH_TOKEN_CACHE_KEY),
    ]);

    if (requireAccessToken && accessToken == null)
      throw new Error("Missing access token");

    const headers = new Headers(options?.headers);
    if (
      !options?.unauthorized &&
      accessToken != null &&
      !headers.has("Authorization")
    )
      headers.set("Authorization", `Bearer ${accessToken}`);

    const response = await fetch(`${apiOrigin}${url}`, {
      ...options,
      headers,
    });

    const createError = () => {
      const error = new Error(response.statusText);
      error.response = response;
      error.code = response.status;
      return error;
    };

    if (accessToken != null && response.status === 401) {
      let newAccessToken;
      try {
        await refreshAccessTokenWithLock(refreshToken);
        const accessToken = await cacheStore.read(ACCESS_TOKEN_CACHE_KEY);
        newAccessToken = accessToken;
      } catch (e) {
        if (e.message !== "refresh-token-expired")
          return Promise.reject(new Error("access-token-refresh-failed"));

        // Log out if the refresh token had expired
        await Promise.all([
          cacheStore.write(ACCESS_TOKEN_CACHE_KEY, null),
          cacheStore.write(REFRESH_TOKEN_CACHE_KEY, null),
        ]);
        emit("user-authentication-expired");
        return Promise.reject(new Error("access-token-expired"));
      }
      const headers = new Headers(options?.headers);
      headers.set("Authorization", `Bearer ${newAccessToken}`);
      return authorizedFetch(url, { ...options, headers });
    }

    if (!response.ok) return Promise.reject(createError());

    // Expect an empty body on 204s
    if (response.status === 204) return undefined;

    return response.json();
  };

  const fetchMe = () =>
    authorizedFetch("/users/me").then((me) => parseUser(me));

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

      return users;
    });

  const fetchUserChannels = (accountAddress) => {
    if (accountAddress == null)
      return authorizedFetch("/users/me/channels").then((rawChannels) => {
        const channels = rawChannels.map(parseChannel);
        return channels;
      });

    return authorizedFetch(`/users/${accountAddress}/channels`, {
      allowUnauthorized: true,
    }).then((rawChannels) => {
      const channels = rawChannels.map(parseChannel);
      return channels;
    });
  };

  const fetchUserChannelsReadStates = () =>
    authorizedFetch("/users/me/read_states").then((readStates) => {
      return readStates;
    });

  const fetchChannel = (id) =>
    authorizedFetch(`/channels/${id}`, {
      allowUnauthorized: true,
    }).then((rawChannel) => {
      const channel = parseChannel(rawChannel);
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
    authorizedFetch("/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "topic",
        name,
        description,
        body,
        tags,
        members: memberWalletAddresses ?? memberUserIds,
        permission_overwrites: permissionOverwrites,
      }),
    }).then((rawChannel) => {
      const channel = parseChannel(rawChannel);
      return channel;
    });

  const fetchChannelMembers = (id) =>
    authorizedFetch(`/channels/${id}/members`, {
      allowUnauthorized: true,
    }).then((rawMembers) => {
      const members = rawMembers.map(parseUser);
      return members;
    });

  const fetchChannelPermissions = (id) =>
    authorizedFetch(`/channels/${id}/permissions`, {
      priority: "low",
    });

  const fetchUserPrivateChannels = () =>
    authorizedFetch("/channels?scope=private").then((rawChannels) => {
      const channels = rawChannels.map(parseChannel);
      return channels;
    });

  const fetchChannelPublicPermissions = (id) =>
    authorizedFetch(`/channels/${id}/permissions`, {
      unauthorized: true,
      priority: "low",
    }).catch((e) => {
      if (e.code === 404) return [];
      throw e;
    });

  const markChannelReadAt = (channelId, { readAt }) =>
    authorizedFetch(`/channels/${channelId}/ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_read_at: readAt.toISOString() }),
    });

  const updateChannelPermissions = (channelId, permissions) =>
    authorizedFetch(`/channels/${channelId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(permissions),
    });

  const fetchStarredItems = () =>
    authorizedFetch("/stars", { priority: "low" }).then((res) =>
      res.map((s) => pickKeys(["id", "type", "reference"], s)),
    );

  const fetchBlockedUsers = () =>
    authorizedFetch("/users/me/blocks").then((blocks) => {
      const userIds = blocks.map((b) => b.user);
      return userIds;
    });

  const fetchPreferences = () =>
    authorizedFetch("/users/me/preferences", { priority: "low" }).then(
      (preferences) => {
        const notificationSettingsByChannelId = mapValues(
          (s) => (s.muted ? "off" : s.mentions ? "mentions" : "all"),
          preferences?.channels ?? {},
        );

        return { notificationSettingsByChannelId };
      },
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
      blockedUserIds,
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
        i.type === "channel" && rawChannels.every((c) => c.id !== i.reference),
    );

    const missingStarredChannels = (
      await Promise.all(
        missingChannelStars.map((s) =>
          fetchChannel(s.reference).catch((e) => {
            // 403 may happen if you have starred a channel you no longer have access to
            if (e.code !== 403 && e.code !== 404) console.error(e);
            return null;
          }),
        ),
      )
    ).filter(Boolean);

    return {
      user: me,
      channels: [...channels, ...missingStarredChannels],
      readStates,
      starredItems,
      apps,
      blockedUserIds,
    };
  };

  const fetchClientBootDataPrivate = async () => {
    const [
      channels_,
      me,
      readStates,
      // starredItems,
      blockedUserIds,
    ] = await Promise.all([
      fetchUserPrivateChannels(),
      fetchMe(),
      fetchUserChannelsReadStates(),
      // fetchStarredItems(),
      fetchBlockedUsers(),
    ]);

    const channels = channels_.map((c) => ({
      ...c,
      memberUserIds: c.memberUserIds == null ? [me.id] : c.memberUserIds,
    }));

    return { user: me, channels, readStates, blockedUserIds };
  };

  return {
    parsers,
    getAuthenticationData: async () => {
      const [accessToken, refreshToken] = await Promise.all([
        cacheStore.read(ACCESS_TOKEN_CACHE_KEY),
        cacheStore.read(REFRESH_TOKEN_CACHE_KEY),
      ]);
      if (accessToken == null) return null;
      return { accessToken, refreshToken };
    },
    async authenticate({
      message,
      signature,
      address,
      signedAt,
      nonce,
      accessToken,
      refreshToken,
    }) {
      if (accessToken != null)
        return Promise.all([
          cacheStore.write(ACCESS_TOKEN_CACHE_KEY, accessToken),
          cacheStore.write(REFRESH_TOKEN_CACHE_KEY, refreshToken),
        ]);

      const body = await fetch(`${apiOrigin}/auth/login`, {
        method: "POST",
        body: JSON.stringify({
          message,
          signature,
          address,
          signed_at: signedAt,
          nonce,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }).then((response) => {
        if (response.ok) return response.json();
        return Promise.reject(new Error(response.statusText));
      });

      await Promise.all([
        cacheStore.write(ACCESS_TOKEN_CACHE_KEY, body.access_token),
        cacheStore.write(REFRESH_TOKEN_CACHE_KEY, body.refresh_token),
      ]);

      return {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
      };
    },
    async connect({ userId }, optionalListener) {
      const accessToken = await cacheStore.read(ACCESS_TOKEN_CACHE_KEY);
      // Pusher.logToConsole = debug;
      const pusher = await initPusherConnection({
        Pusher,
        key: pusherKey,
        accessToken,
        apiOrigin,
      });

      const channel = pusher.subscribe(`private-${userId}`);

      for (let eventName of Object.keys(serverEventMap))
        channel.bind(eventName, (data) => {
          const [parsedName, payload] = parseServerEvent(eventName, data);
          optionalListener?.(parsedName, payload);
          emit(parsedName, payload);
        });

      pusher.connection.bind("state_change", ({ current }) => {
        const connected = current === "connected";
        optionalListener?.("connection-state-change", { connected });
        emit("connection-state-change", { connected });
      });

      const connected = pusher.connection.state === "connected";
      optionalListener?.("connection-state-change", { connected });
      emit("connection-state-change", { connected });

      return () => {
        // Disconnect
        pusher.connection.unbind("state_change");
        pusher.disconnect();
      };
    },
    fetchMe,
    updateMe,
    deleteMe() {
      return authorizedFetch("/users/me", { method: "DELETE" });
    },
    fetchBlockedUsers,
    fetchPreferences,
    async setChannelNotificationSetting(channelId, setting) {
      // Nice
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

    async fetchUser({ accountAddress }) {
      const rawUsers = await authorizedFetch("/users/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_addresses: [accountAddress] }),
        allowUnauthorized: true,
      });
      const users = rawUsers.map(parseUser);
      return users[0];
    },
    fetchUsers,
    fetchMessage(id) {
      return authorizedFetch(`/messages/${id}`).then((rawMessage) => {
        const message = parseMessage(rawMessage);
        return message;
      });
    },
    // Replace with `fetchMessage`?
    async fetchChannelMessage(channelId, messageId) {
      const rawMessage = await authorizedFetch(
        `/channels/${channelId}/messages/${messageId}`,
        {
          allowUnauthorized: true,
        },
      );

      if (rawMessage != null) return parseMessage(rawMessage);

      return {
        id: messageId,
        channelId,
        deleted: true,
      };
    },
    fetchMessages(
      channelId,
      { limit = 50, beforeMessageId, afterMessageId } = {},
    ) {
      if (limit == null) throw new Error(`Missing required "limit" argument`);

      const searchParams = new URLSearchParams(
        [
          ["before", beforeMessageId],
          ["after", afterMessageId],
          ["limit", limit],
        ].filter((e) => e[1] != null),
      );

      const url = [`/channels/${channelId}/messages`, searchParams.toString()]
        .filter((s) => s !== "")
        .join("?");

      return authorizedFetch(url, { allowUnauthorized: true }).then(
        (rawMessages) => {
          const messages = rawMessages.map(parseMessage);
          return messages;
        },
      );
    },
    async fetchLastChannelMessage(channelId) {
      const [message] = await authorizedFetch(
        `/channels/${channelId}/messages?limit=1`,
        { allowUnauthorized: true },
      ).then((ms) => ms.map(parseMessage));

      if (message == null) return null;

      if (message.replyTargetMessageId == null) return message;

      const fetchLastNonReplyBeforeMessage = async (messageId) => {
        const [message] = await authorizedFetch(
          `/channels/${channelId}/messages?limit=1&before=${messageId}`,
          { allowUnauthorized: true },
        ).then((ms) => ms.map(parseMessage));
        if (message.replyTargetMessageId == null) return message;
        return fetchLastNonReplyBeforeMessage(message.id);
      };

      return fetchLastNonReplyBeforeMessage(message.id);
    },
    async createChannelMessage(
      channelId,
      { blocks, stringContent, replyTargetMessageId },
    ) {
      const rawMessage = await authorizedFetch("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: channelId,
          blocks,
          content: stringContent,
          reply_to: replyTargetMessageId,
        }),
      });
      const message = parseMessage(rawMessage);
      return message;
    },
    async updateMessage(messageId, { blocks }) {
      const rawMessage = await authorizedFetch(`/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks,
          content: stringifyMessageBlocks(blocks, { humanReadable: false }),
        }),
      });
      const message = parseMessage(rawMessage);
      return message;
    },
    async removeMessage(messageId) {
      await authorizedFetch(`/messages/${messageId}`, {
        method: "DELETE",
      });
      return { id: messageId };
    },
    reportMessage(messageId, { comment }) {
      return authorizedFetch(`/messages/${messageId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment, reason: "other" }),
      });
    },
    addMessageReaction(messageId, { emoji }) {
      return authorizedFetch(
        `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        { method: "POST" },
      );
    },
    removeMessageReaction(messageId, { emoji }) {
      return authorizedFetch(
        `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        { method: "DELETE" },
      );
    },
    fetchChannel,
    fetchUserChannels,
    fetchUserPrivateChannels,
    async fetchPubliclyReadableChannels(query) {
      const searchParams = new URLSearchParams({
        scope: "discovery",
        ...query,
      });
      const rawChannels = await authorizedFetch(`/channels?${searchParams}`, {
        allowUnauthorized: true,
      });
      const channels = rawChannels.map(parseChannel);
      return channels;
    },
    async fetchUserMessages(userId) {
      const rawMessages = await authorizedFetch(`/users/${userId}/messages`);
      const messages = rawMessages.map(parseMessage);
      return messages;
    },
    fetchUserChannelsReadStates,
    createChannel,
    async createDmChannel({ name, memberUserIds, memberWalletAddresses }) {
      const rawChannel = await authorizedFetch("/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind: "dm",
          members: memberWalletAddresses ?? memberUserIds,
        }),
      });
      return parseChannel(rawChannel);
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
      });
    },
    removeChannelMember(channelId, userId) {
      return authorizedFetch(`/channels/${channelId}/members/${userId}`, {
        method: "DELETE",
      });
    },
    joinChannel(channelId) {
      return authorizedFetch(`/channels/${channelId}/join`, {
        method: "POST",
      });
    },
    leaveChannel(channelId) {
      return authorizedFetch(`/channels/${channelId}/members/me`, {
        method: "DELETE",
      });
    },
    async updateChannel(channelId, { name, description, avatar, body }) {
      const rawChannel = await authorizedFetch(`/channels/${channelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanString(name),
          description: cleanString(description),
          avatar: cleanString(avatar),
          body,
        }),
      });
      return parseChannel(rawChannel);
    },
    deleteChannel(id) {
      return authorizedFetch(`/channels/${id}`, { method: "DELETE" });
    },
    updateChannelPermissions,
    fetchStarredItems,
    fetchApps() {
      return authorizedFetch("/apps", {
        allowUnauthorized: true,
        priority: "low",
      });
    },
    reportUser(userId, { comment }) {
      return authorizedFetch("/users/me/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: userId, reason: "other", comment }),
      });
    },
    blockUser(userId) {
      return authorizedFetch("/users/me/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: userId }),
      });
    },
    unblockUser(userId) {
      return authorizedFetch(`/users/me/blocks/${userId}`, {
        method: "DELETE",
      });
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
        })),
      );
    },
    uploadImageWithUrl(url) {
      return authorizedFetch("/media/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }).then(({ id }) => ({
        id,
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
        { method: "POST" },
      );
    },
    promptChatGPT(prompt) {
      return authorizedFetch(
        `/integrations/chatgpt?message=${encodeURIComponent(prompt)}`,
        { method: "POST" },
      );
    },
    markChannelReadAt,
    starItem,
    unstarItem,
    fetchClientBootDataFull,
    fetchClientBootDataPrivate,
    addListener(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
