const commands = {
  // nick: ({ actions, context, serverId }) => ({
  //   description: "Update your nickname for this server",
  //   execute: async ({ args, editor }) => {
  //     const displayName = args.join(" ");
  //     await actions.updateMe({ displayName, serverId });
  //     editor.clear();
  //   },
  //   exclude: () => context !== "server",
  // }),
  "set-nickname": ({ actions }) => ({
    description:
      "Update your global nickname. This will be used in all channels.",
    execute: async ({ args, editor }) => {
      const displayName = args.join(" ");
      await actions.updateMe({ displayName });
      editor.clear();
    },
  }),
  // pfp: ({ context, actions, serverId }) => ({
  //   description:
  //     "Update your server profile picture. Use a URL from OpenSea, Rarible, or LooksRare OR copy paste the specific '<contract_address> <token_id>'.",
  //   execute: async ({ args, editor }) => {
  //     const pfp = args.join(" ");
  //     await actions.updateMe({ pfp, serverId });
  //     editor.clear();
  //   },
  //   exclude: () => context !== "server",
  // }),
  "set-profile-picture": ({ actions }) => ({
    description:
      "Update your global profile picture. This will be used in all channels. For NFTs: use a URL from OpenSea, Rarible, or LooksRare OR copy paste the specific '<contract_address> <token_id>'.",
    arguments: ["image-url"],
    execute: async ({ args, editor }) => {
      const pfp = args.join(" ");
      await actions.updateMe({ pfp });
      editor.clear();
    },
  }),
  "clear-profile-picture": ({ actions }) => ({
    description:
      "Clears your profile picture. This will give you a default avatar, or display your ENS avatar if set.",
    execute: async ({ editor }) => {
      await actions.updateMe({ pfp: null });
      editor.clear();
    },
  }),
};

export default commands;
