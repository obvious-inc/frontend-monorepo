const commands = {
  nick: ({ actions, context, serverId }) => ({
    description: "Update your nickname for this server",
    execute: async ({ args, editor }) => {
      const displayName = args.join(" ");
      await actions.updateMe({ displayName, serverId });
      editor.clear();
    },
    exclude: () => context === "dm",
  }),
  "nick-global": ({ actions }) => ({
    description:
      "Update your global nickname. This will be used if you don’t set a server specific nickname with the /nick command.",
    execute: async ({ args, editor }) => {
      const displayName = args.join(" ");
      await actions.updateMe({ displayName });
      editor.clear();
    },
  }),
  pfp: ({ context, actions, serverId }) => ({
    description:
      "Update your server profile picture. Use a URL from OpenSea, Rarible, or LooksRare OR copy paste the specific '<contract_address> <token_id>'.",
    execute: async ({ args, editor }) => {
      const pfp = args.join(" ");
      await actions.updateMe({ pfp, serverId });
      editor.clear();
    },
    exclude: () => context === "dm",
  }),
  "pfp-global": ({ actions }) => ({
    description:
      "Update your user profile picture. This will be used if you don’t set a server specific profile picture.",
    execute: async ({ args, editor }) => {
      const pfp = args.join(" ");
      await actions.updateMe({ pfp });
      editor.clear();
    },
  }),
};

export default commands;
