export const CHANNEL_READ_INFO = "channels.view";
export const CHANNEL_READ_MEMBER_LIST = "channels.members.list";
export const CHANNEL_READ_MESSAGES = "messages.list";
export const CHANNEL_ADD_MEMBER = "channels.invite";
export const CHANNEL_JOIN = "channels.join";
export const CHANNEL_WRITE_MESSAGES = "messages.create";

const Permissions = Object.freeze({
  [CHANNEL_WRITE_MESSAGES]: "Send new messages",
  [CHANNEL_READ_MESSAGES]: "List topic messages",
  "channels.create": "Create new topics",
  [CHANNEL_READ_INFO]: "View topic information",
  [CHANNEL_ADD_MEMBER]: "Add users to topic",
  [CHANNEL_JOIN]: "Join topic",
  "channels.permissions.manage": "Manage topic permissions",
  "channels.kick": "Kick users from topic",
  "channels.delete": "Delete topic",
  [CHANNEL_READ_MEMBER_LIST]: "List users in topic",
  "members.kick": "Kick members",
  "roles.list": "List roles",
  "roles.create": "Create roles",
  "apps.manage": "Manage topic apps",
});

const closedChannelPublicPermissions = [
  CHANNEL_READ_INFO,
  CHANNEL_READ_MEMBER_LIST,
  CHANNEL_READ_MESSAGES,
];
const openChannelPublicPermissions = [
  ...closedChannelPublicPermissions,
  CHANNEL_JOIN,
];

export const privateChannelPermissionOverrides = [
  {
    group: "@public",
    permissions: [],
  },
];

export const closedChannelPermissionOverrides = [
  {
    group: "@public",
    permissions: closedChannelPublicPermissions,
  },
];

export const openChannelPermissionOverrides = [
  {
    group: "@public",
    permissions: openChannelPublicPermissions,
  },
];

export const parseScopes = (scopes) =>
  scopes?.map((scope) => ({ key: scope, content: Permissions[scope] }));
