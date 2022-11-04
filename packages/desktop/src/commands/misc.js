import {
  getImageDimensionsFromUrl,
  message as messageUtils,
} from "@shades/common/utils";
import { getChecksumAddress } from "../utils/ethereum";
import { send as sendNotification } from "../utils/notifications";
import {
  getNoun,
  getRandomNoun,
  getRandomNounWithSeedInput,
} from "../utils/nouns";

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
  logout: ({ actions }) => ({
    description: "Logs you out, really fast.",
    execute: async () => {
      actions.logout();
      window.location.reload();
    },
  }),
  "dall-e": ({ actions }) => ({
    arguments: ["prompt"],
    description: "Have patience, DALL·E is in no hurry.",
    execute: async ({ args, editor, submit }) => {
      const prompt = args.join(" ");
      try {
        const response = await actions.promptDalle(prompt);

        const { width, height } = await getImageDimensionsFromUrl(response.url);
        submit([
          {
            type: "paragraph",
            children: [
              {
                text: `${prompt.slice(0, 1).toUpperCase()}${prompt.slice(1)}`,
                italic: true,
              },
            ],
          },
          {
            type: "attachments",
            children: [
              {
                type: "image-attachment",
                url: response.url,
                width,
                height,
              },
            ],
          },
        ]);

        editor.clear();
      } catch (e) {
        throw new Error("DALL·E hates your prompt");
      }
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
      const parseParts = (parts) => {
        const [body, accessory, head, glasses] = parts.map((p) =>
          p.filename.split("-").slice(1).join(" ")
        );
        return { body, accessory, head, glasses };
      };

      let url, parts;
      if (!args || args.length == 0) {
        ({ url, parts } = await getRandomNoun());
      } else {
        if (args.length == 1 && Number.isInteger(Number(args[0]))) {
          const nounId = Number(args[0]);
          ({ url, parts } = await getNoun(nounId, ethersProvider));
        } else if (args.length == 1) {
          ({ url, parts } = await getRandomNounWithSeedInput(args[0]));
        } else {
          // TODO: not sure yet what to do
          alert("Only 1 input for now.");
          return;
        }
      }

      const { body, accessory, head, glasses } = parseParts(parts);

      const blocks = [
        {
          type: "attachments",
          children: [
            {
              type: "image-attachment",
              url: url,
              width: 320,
              height: 320,
            },
          ],
        },
        {
          type: "paragraph",
          children: [
            ["H", head],
            ["G", glasses],
            ["B", body],
            ["A", accessory],
          ].flatMap(([char, part], i, els) => {
            const isLast = i === els.length - 1;
            return [
              { text: char, bold: true },
              { text: `: ${isLast ? part : `${part}, `}` },
            ];
          }),
        },
      ];

      actions.createMessage({ channel: channelId, blocks });

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
