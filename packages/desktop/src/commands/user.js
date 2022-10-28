const commands = {
  "set-nickname": ({ actions }) => ({
    description:
      "Update your global nickname. This will be used in all channels.",
    execute: async ({ args, editor }) => {
      const displayName = args.join(" ");
      await actions.updateMe({ displayName });
      editor.clear();
    },
  }),
  "set-profile-picture": ({ actions }) => ({
    description:
      "Update your global profile picture. This will be used in all channels. For NFTs: use a URL from OpenSea, Rarible, or LooksRare OR copy paste the specific '<contract_address> <token_id>'.",
    arguments: ["image-url"],
    execute: async ({ args, editor }) => {
      const joinedArgs = args.join(" ");
      await actions.updateMe({
        profilePicture: joinedArgs.trim() === "" ? null : joinedArgs,
      });
      editor.clear();
    },
  }),
  "clear-profile-picture": ({ actions }) => ({
    description:
      "Clears your profile picture. This will give you a default avatar, or display your ENS avatar if set.",
    execute: async ({ editor }) => {
      await actions.updateMe({ profilePicture: null });
      editor.clear();
    },
  }),
};

export default commands;
