const Permissions = Object.freeze({
  "messages.create": "Send new messages",
  "messages.list": "List channel's messages",
  "channels.create": "Create new channels",
  "channels.view": "View channel information",
  "channels.invite": "Invite users to channel",
  "channels.join": "Join channels",
  "channels.permissions.manage": "Manage channel's permissions",
  "channels.kick": "Kick users from channel",
  "channels.delete": "Delete channels",
  "channels.members.list": "List users in channel",
  "members.kick": "Kick members",
  "roles.list": "List roles",
  "roles.create": "Create roles",
  "apps.manage": "Manage channel's apps",
});

export const parseScopes = (scopes) => {
  return scopes?.map(function (scope) {
    return { key: scope, content: Permissions[scope] };
  });
};
