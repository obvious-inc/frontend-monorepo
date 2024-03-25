import { isAddress as isEthereumAccountAddress } from "viem";
import { normalize as normalizeEnsName } from "viem/ens";
import { send as sendNotification } from "../utils/notifications";

const commands = {
  dm: ({ state, navigate, publicEthereumClient }) => ({
    arguments: ["wallet-address-or-ens-name"],
    description: "Start a one-to-one conversation with a wallet",
    execute: async ({ args, editor }) => {
      const query = args[0];

      try {
        const resolvedAddress = isEthereumAccountAddress(query)
          ? query
          : await publicEthereumClient.getEnsAddress({
              name: normalizeEnsName(query),
            });

        const channel = state.selectDmChannelWithMember(resolvedAddress);

        if (channel == null) {
          navigate(`/new?account=${resolvedAddress}`);
          return;
        }

        navigate(`/channels/${channel.id}`);
        editor.clear();
      } catch (e) {
        navigate(`/new?query=${query}`);
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
          "Permission rejected. If you wish to turn system notification on, run the command again and grant permission when prompted.",
        );
      }

      editor.clear();
    },
  }),
};

export default commands;
