import {
  isAddress as isEthereumAccountAddress,
  getAddress as checksumEncodeAddress,
} from "viem";
import { normalize as normalizeEnsName } from "viem/ens";

const commands = {
  "create-channel": ({ actions, navigate }) => ({
    description: "Start a new channel",
    arguments: ["name"],
    execute: async ({ args, editor }) => {
      const name = args.join(" ");
      if (name.trim().length === 0) {
        alert('"name" is a required argument!');
        return;
      }

      const channel = await actions.createPrivateChannel({ name });
      editor.clear();
      navigate(`/channels/${channel.id}`);
    },
  }),
  "set-channel-name": ({ context, user, state, actions, channelId }) => ({
    description: "Set a new name for this channel",
    arguments: ["channel-name"],
    execute: async ({ args, editor }) => {
      if (context !== "dm" && args.length < 1) {
        alert('Argument "channel-name" is required');
        return;
      }
      const channelName = args.join(" ");
      await actions.updateChannel(channelId, {
        name: channelName.trim() === "" ? null : channelName,
      });
      editor.clear();
    },
    exclude: () => {
      if (context === "dm") return false;

      if (context === "topic") {
        const channel = state.selectChannel(channelId);
        return user.id !== channel.ownerUserId;
      }

      return true;
    },
  }),
  "set-channel-avatar": ({ context, user, state, actions, channelId }) => ({
    description: "Set a new avatar for this channel",
    arguments: ["channel-avatar-url"],
    execute: async ({ args, editor }) => {
      const arg = args[0]?.trim() === "" ? null : args[0];
      const isUrlOrEmpty = arg == null || arg.match(/^https?:\/\//);

      if (!isUrlOrEmpty) {
        alert(`"${arg}" is not a url!`);
        return;
      }

      await actions.updateChannel(channelId, { avatar: arg ?? null });
      editor.clear();
    },
    exclude: () => {
      if (context === "dm") return false;

      if (context === "topic") {
        const channel = state.selectChannel(channelId);
        return channel?.ownerUserId !== user.id;
      }

      return true;
    },
  }),
  "delete-channel": ({
    context,
    user,
    state,
    actions,
    navigate,
    channelId,
  }) => ({
    description: "Delete the current channel",
    execute: async ({ editor }) => {
      if (!confirm("Are you sure you want to delete this channel?")) return;
      await actions.deleteChannel(channelId);
      editor.clear();
      navigate("/", { replace: true });
    },
    exclude: () => {
      if (context === "dm") return true;

      if (context === "topic") {
        const channel = state.selectChannel(channelId);
        return channel == null || user.id !== channel.ownerUserId;
      }

      return true;
    },
  }),
  "add-member": ({
    state,
    actions,
    channelId,
    user,
    publicEthereumClient,
  }) => ({
    description: "Add members to this channel",
    arguments: ["ethereum-account-address-or-ens"],
    execute: async ({ args, editor }) => {
      const walletAddressOrEnsList = args;
      if (walletAddressOrEnsList.length === 0) return;

      const addresses = [];

      for (let walletAddressOrEns of walletAddressOrEnsList) {
        try {
          const address = isEthereumAccountAddress(walletAddressOrEns)
            ? walletAddressOrEns
            : await publicEthereumClient.getEnsAddress({
                name: normalizeEnsName(walletAddressOrEns),
              });

          addresses.push(checksumEncodeAddress(address));
        } catch (e) {
          if (e.code === "INVALID_ARGUMENT")
            throw new Error(`Invalid address "${walletAddressOrEns}"`);
          throw e;
        }
      }

      await actions.addChannelMember(channelId, addresses);
      editor.clear();
    },
    exclude: () => {
      const channel = state.selectChannel(channelId);
      return (
        channel == null ||
        channel.kind !== "topic" ||
        channel.ownerUserId !== user.id
      );
    },
  }),
  "remove-member": ({
    state,
    actions,
    channelId,
    user,
    publicEthereumClient,
  }) => ({
    description: "Remove a member from this channel",
    arguments: ["ethereum-account-address-or-ens"],
    execute: async ({ args, editor }) => {
      const [walletAddressOrEns] = args;
      if (walletAddressOrEns == null) return;

      try {
        const rawAddress = isEthereumAccountAddress(walletAddressOrEns)
          ? walletAddressOrEns
          : await publicEthereumClient.getEnsAddress({
              name: normalizeEnsName(walletAddressOrEns),
            });

        const address = checksumEncodeAddress(rawAddress);

        const user = state.selectUserFromWalletAddress(address);

        if (user == null) {
          alert(`No member with address "${address}"!`);
          return;
        }

        await actions.removeChannelMember(channelId, user.id);
        editor.clear();
      } catch (e) {
        if (e.code === "INVALID_ARGUMENT") throw new Error("Invalid address");
        throw e;
      }
    },
    exclude: () => {
      const channel = state.selectChannel(channelId);
      return (
        channel == null ||
        channel.kind !== "topic" ||
        channel.ownerUserId !== user.id
      );
    },
  }),
  "join-channel": ({ state, actions, channelId, user }) => {
    const channel = state.selectChannel(channelId, { name: true });
    return {
      description: `Join "#${channel?.name}".`,
      execute: async ({ editor }) => {
        await actions.joinChannel(channelId);
        editor.clear();
      },
      exclude: () =>
        channel == null ||
        channel.kind !== "topic" ||
        channel.memberUserIds.includes(user.id),
    };
  },
  "leave-channel": ({ state, actions, channelId, user }) => {
    const channel = state.selectChannel(channelId, { name: true });
    return {
      description: `Leave "#${channel?.name}".`,
      execute: async ({ editor }) => {
        await actions.leaveChannel(channelId);
        editor.clear();
      },
      exclude: () =>
        channel == null ||
        channel.kind !== "topic" ||
        channel.ownerUserId === user.id,
    };
  },
  "open-write-access": ({ state, actions, channelId, user }) => {
    const channel = state.selectChannel(channelId, { name: true });
    const accessLevel = state.selectChannelAccessLevel(channelId);
    return {
      description: `Make "#${channel?.name}" a completely open channel that anyone can join`,
      execute: async ({ editor }) => {
        await actions.makeChannelOpen(channelId);
        editor.clear();
      },
      exclude: () =>
        channel == null ||
        accessLevel === "open" ||
        channel.kind !== "topic" ||
        channel.ownerUserId !== user.id ||
        (accessLevel === "private" && channel.memberUserIds.length > 1),
    };
  },
  "open-read-access": ({ state, actions, channelId, user }) => {
    const channel = state.selectChannel(channelId, { name: true });
    const accessLevel = state.selectChannelAccessLevel(channelId);
    return {
      description: `Make "#${channel?.name}" an open channel that anyone can see. Write access will remain members-only.`,
      execute: async ({ editor }) => {
        await actions.makeChannelClosed(channelId);
        editor.clear();
      },
      exclude: () =>
        channel == null ||
        accessLevel === "closed" ||
        channel.kind !== "topic" ||
        channel.ownerUserId !== user.id ||
        (accessLevel === "private" && channel.memberUserIds.length > 1),
    };
  },
  "close-read-access": ({ state, actions, channelId, user }) => {
    const channel = state.selectChannel(channelId, { name: true });
    const accessLevel = state.selectChannelAccessLevel(channelId);
    return {
      description: `Make "#${channel?.name}" a private channel that only members can see`,
      execute: async ({ editor }) => {
        await actions.makeChannelPrivate(channelId);
        editor.clear();
      },
      exclude: () =>
        channel == null ||
        channel.kind !== "topic" ||
        channel.ownerUserId !== user.id ||
        accessLevel === "private",
    };
  },
};

export default commands;
