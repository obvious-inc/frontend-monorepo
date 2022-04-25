import { getChecksumAddress } from "../utils/ethereum";

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
      const server = state.selectServer(serverId);
      return server?.ownerUserId !== user.id;
    },
  }),
  logout: ({ signOut }) => ({
    description: "Logs you out, really fast.",
    execute: async () => {
      signOut();
    },
  }),
};

export default commands;
