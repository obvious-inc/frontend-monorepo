import { getImageDimensionsFromUrl } from "@shades/common";
import { getChecksumAddress } from "../utils/ethereum";
import { send as sendNotification } from "../utils/notifications";
import { getNoun, getRandomNoun } from "../utils/nouns";
import stringifyMessageBlocks from "../slate/stringify";

const commands = {
  dm: ({ actions, state, navigate, ethersProvider }) => ({
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
        const resolvedAddress = await Promise.all(
          addresses.map((a) => ethersProvider.resolveName(a))
        );

        const checksumAddresses = await Promise.all(
          resolvedAddress.map(getChecksumAddress)
        );
        const users = checksumAddresses.map(state.selectUserFromWalletAddress);
        const joinedChannel = users.some((u) => u == null)
          ? null
          : state.selectDmChannelFromUserIds(users.map((u) => u.id));

        const channel =
          joinedChannel ??
          (await actions.createDmChannel({
            memberWalletAddresses: checksumAddresses,
          }));
        editor.clear();
        navigate(`/channels/${channel.id}`);
      } catch (e) {
        if (e.code === "INVALID_ARGUMENT") throw new Error("Invalid address");
        throw e;
      }
    },
  }),
  // "set-town-name": ({ user, state, actions, serverId }) => ({
  //   description: "Update town name",
  //   arguments: ["town-name"],
  //   execute: async ({ args, editor }) => {
  //     if (args.length === 0) {
  //       alert('Missing argument "town-name"');
  //       return;
  //     }
  //     const serverName = args.join(" ");
  //     await actions.updateServer(serverId, { name: serverName });
  //     editor.clear();
  //   },
  //   exclude: () => {
  //     const server = state.selectServer(serverId);
  //     return server?.ownerUserId !== user.id;
  //   },
  // }),
  // "set-town-description": ({ user, state, actions, serverId }) => ({
  //   description: "Update town description. This is visible on your invite page",
  //   arguments: ["town-description"],
  //   execute: async ({ args, editor }) => {
  //     if (args.length === 0) {
  //       alert('Missing argument "town-description"');
  //       return;
  //     }
  //     const serverDescription = args.join(" ");
  //     await actions.updateServer(serverId, { description: serverDescription });
  //     editor.clear();
  //   },
  //   exclude: () => {
  //     const server = state.selectServer(serverId);
  //     return server?.ownerUserId !== user.id;
  //   },
  // }),
  // "set-system-messages-channel": ({
  //   user,
  //   state,
  //   actions,
  //   context,
  //   serverId,
  // }) => ({
  //   description:
  //     'Configure a channel for receiving system messages, e.g. "John Doe has joined!"',
  //   arguments: ["channel-name"],
  //   execute: async ({ args, editor }) => {
  //     if (args.length === 0) {
  //       alert('Missing argument "channel-name"');
  //       return;
  //     }
  //     const channelName = args.join(" ");
  //     const channels = state
  //       .selectServerChannels(serverId)
  //       .filter((c) => c.name === channelName);

  //     if (channels.length === 0) {
  //       alert(`No channel named "${channelName}"`);
  //       return;
  //     }

  //     if (channels.length !== 1) {
  //       alert(`You have multiple channels named "${channelName}". Stop it!`);
  //       return;
  //     }

  //     await actions.updateServer(serverId, { system_channel: channels[0].id });
  //     editor.clear();
  //   },
  //   exclude: () => {
  //     if (context !== "server") return true;
  //     const server = state.selectServer(serverId);
  //     return server?.ownerUserId !== user.id;
  //   },
  // }),
  // "update-server": ({ user, state, actions, serverId }) => ({
  //   description: "Update a server property",
  //   arguments: ["propery-name", "property-value"],
  //   execute: async ({ args, editor }) => {
  //     if (args.length < 2) {
  //       alert('Arguments #1 "property", and #2 "value", are required.');
  //       return;
  //     }
  //     const [property, ...valueWords] = args;
  //     const value = valueWords.join(" ");
  //     await actions.updateServer(serverId, { [property]: value });
  //     editor.clear();
  //   },
  //   exclude: () => {
  //     if (!location.search.includes("root")) return true;
  //     const server = state.selectServer(serverId);
  //     return server?.ownerUserId !== user.id;
  //   },
  // }),
  logout: ({ navigate, actions }) => ({
    description: "Logs you out, really fast.",
    execute: async () => {
      actions.logout();
      navigate("/");
    },
  }),
  gif: ({ actions }) => ({
    description: "!vibe",
    arguments: ["search-query"],
    execute: async ({ args, editor, submit }) => {
      const query = args.join(" ");
      const response = await actions.searchGifs(query);
      if (response.length === 0) return;
      const imageUrl =
        response[Math.floor(Math.random() * response.length)].src;

      const { width, height } = await getImageDimensionsFromUrl(imageUrl);
      submit([
        {
          type: "attachments",
          children: [
            {
              type: "image-attachment",
              url: imageUrl,
              width,
              height,
            },
          ],
        },
      ]);

      editor.clear();
    },
  }),
  "gif-nounish": ({ actions }) => ({
    description: "⌐◨-◨",
    arguments: ["search-query"],
    execute: async ({ args, editor, submit }) => {
      const query = args.join(" ");
      const response = await actions.searchGifs(`nounish nouns ${query}`);
      if (response.length === 0) return;

      const imageUrl = response[0].src;

      const { width, height } = await getImageDimensionsFromUrl(imageUrl);
      submit([
        {
          type: "attachments",
          children: [
            {
              type: "image-attachment",
              url: imageUrl,
              width,
              height,
            },
          ],
        },
      ]);

      editor.clear();
    },
  }),
  noun: ({ actions, channelId, ethersProvider }) => ({
    description: "F-U-N",
    execute: async ({ args, editor }) => {
      let url, parts, seed;
      if (!args || args.length == 0) {
        ({ url, parts, seed } = await getRandomNoun());
      } else {
        if (args.length == 1 && Number.isInteger(Number(args[0]))) {
          const nounId = Number(args[0]);
          ({ url, parts, seed } = await getNoun(nounId, ethersProvider));
        } else {
          // TODO: add search by trait name
          return;
        }
      }

      let strParts = parts
        .map((part) => {
          return [
            { text: `${part.filename.split("-")[0]}: `, bold: true },
            { text: part.filename.split("-").slice(1).join(" ") + "\n" },
          ];
        })
        .flat();

      strParts.push(
        { text: "seed: ", bold: true },
        { text: `(${Object.values(seed).join(", ")})` }
      );

      const blocks = [
        {
          type: "attachments",
          children: [
            {
              type: "image-attachment",
              url: url,
              width: "320px",
              height: "320px",
            },
          ],
        },
        {
          type: "paragraph",
          children: strParts,
        },
      ];

      actions.createMessage({
        channel: channelId,
        content: stringifyMessageBlocks(blocks),
        blocks,
      });

      editor.clear();
    },
  }),
  "enable-notifications": () => ({
    description:
      "Turn on system notifications. Super alpha, only for the brave or crazy.",
    execute: async ({ editor }) => {
      if (Notification.permission === "granted") {
        sendNotification({ title: "System notifications already enabled!" });
        editor.clear();
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        sendNotification({ title: "System notifications enabled!" });
        window.location.reload();
      } else {
        alert(
          "Permission rejected. If you wish to turn system notification on, run the command again and grant permission when prompted."
        );
      }

      editor.clear();
    },
  }),
};

export default commands;
