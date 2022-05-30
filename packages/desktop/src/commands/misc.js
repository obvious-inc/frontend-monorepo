import { getChecksumAddress } from "../utils/ethereum";
import { send as sendNotification } from "../utils/notifications";

const commands = {
  dm: ({ actions, state, navigate }) => ({
    description:
      'Direct message. Usage: "/dm <wallet-address> [...<wallet-address>]"',
    execute: async ({ args, editor }) => {
      let addresses = args;
      if (addresses[0] == null) {
        const addressPromptAnswer = prompt(
          "Give the wallet address of the user you want to message"
        );
        if (addressPromptAnswer == null) return;
        addresses = addressPromptAnswer.split(" ").map((s) => s.trim());
      }

      try {
        const checksumAddresses = await Promise.all(
          addresses.map(getChecksumAddress)
        );
        const users = checksumAddresses.map(state.selectUserFromWalletAddress);
        if (users.some((u) => u == null))
          return Promise.reject(new Error("User not found"));
        const channel =
          state.selectDmChannelFromUserIds(users.map((u) => u.id)) ??
          (await actions.createChannel({
            kind: "dm",
            memberUserIds: users.map((u) => u.id),
          }));
        editor.clear();
        navigate(`/channels/@me/${channel.id}`);
      } catch (e) {
        if (e.code === "INVALID_ARGUMENT") throw new Error("Invalid address");
        throw e;
      }
    },
  }),
  "set-town-name": ({ user, state, actions, serverId }) => ({
    description: "Update town name",
    arguments: ["town-name"],
    execute: async ({ args, editor }) => {
      if (args.length === 0) {
        alert('Missing argument "town-name"');
        return;
      }
      const serverName = args.join(" ");
      await actions.updateServer(serverId, { name: serverName });
      editor.clear();
    },
    exclude: () => {
      const server = state.selectServer(serverId);
      return server?.ownerUserId !== user.id;
    },
  }),
  "set-town-description": ({ user, state, actions, serverId }) => ({
    description: "Update town description. This is visible on your invite page",
    arguments: ["town-description"],
    execute: async ({ args, editor }) => {
      if (args.length === 0) {
        alert('Missing argument "town-description"');
        return;
      }
      const serverDescription = args.join(" ");
      await actions.updateServer(serverId, { description: serverDescription });
      editor.clear();
    },
    exclude: () => {
      const server = state.selectServer(serverId);
      return server?.ownerUserId !== user.id;
    },
  }),
  "set-system-messages-channel": ({ user, state, actions, serverId }) => ({
    description:
      'Configure a channel for receiving system messages, e.g. "John Doe has joined!"',
    arguments: ["channel-name"],
    execute: async ({ args, editor }) => {
      if (args.length === 0) {
        alert('Missing argument "channel-name"');
        return;
      }
      const channelName = args.join(" ");
      const channels = state
        .selectServerChannels(serverId)
        .filter((c) => c.name === channelName);

      if (channels.length === 0) {
        alert(`No channel named "${channelName}"`);
        return;
      }

      if (channels.length !== 1) {
        alert(`You have multiple channels named "${channelName}". Stop it!`);
        return;
      }

      await actions.updateServer(serverId, { system_channel: channels[0].id });
      editor.clear();
    },
    exclude: () => {
      const server = state.selectServer(serverId);
      return server?.ownerUserId !== user.id;
    },
  }),
  "update-server": ({ user, state, actions, serverId }) => ({
    description: "Update a server property",
    arguments: ["propery-name", "property-value"],
    execute: async ({ args, editor }) => {
      if (args.length < 2) {
        alert('Arguments #1 "property", and #2 "value", are required.');
        return;
      }
      const [property, ...valueWords] = args;
      const value = valueWords.join(" ");
      await actions.updateServer(serverId, { [property]: value });
      editor.clear();
    },
    exclude: () => {
      if (!location.search.includes("root")) return true;
      const server = state.selectServer(serverId);
      return server?.ownerUserId !== user.id;
    },
  }),
  logout: ({ navigate, actions }) => ({
    description: "Logs you out, really fast.",
    execute: async () => {
      actions.logout();
      navigate("/");
    },
  }),
  "enable-notifications": () => ({
    description:
      "Turn on system notifications. Super alpha, it’s not meant to be used really.",
    execute: async ({ editor }) => {
      if (Notification.permission === "granted") {
        sendNotification("System notifications already enabled!");
        editor.clear();
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        sendNotification("System notifications enabled!");
        window.location.reload();
      } else {
        alert(
          "Permission to send system notification rejected. Run this command again and grant permission, to turn on system notifications."
        );
      }

      editor.clear();
    },
  }),
};

export default commands;
