import { Editor, Transforms } from "slate";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useAppScope, objectUtils } from "@shades/common";
import { getChecksumAddress } from "../utils/ethereum";

const { mapValues } = objectUtils;

const prependTextCommands = {
  gm: {
    text: "░██████╗░███╗░░░███╗\n██╔════╝░████╗░████║\n██║░░██╗░██╔████╔██║\n██║░░╚██╗██║╚██╔╝██║\n╚██████╔╝██║░╚═╝░██║\n░╚═════╝░╚═╝░░░░░╚═╝",
    description: "gm louder",
  },
};

const appendTextCommands = {
  fliptable: {
    text: "(╯°□°）╯︵ ┻━┻",
    description: "Flip tables (╯°□°）╯︵ ┻━┻",
  },
  shrug: {
    text: "¯\\_(ツ)_/¯",
    description: "Appends a shrug to your message ¯\\_(ツ)_/¯",
  },
  lenny: {
    text: "( ͡° ͜ʖ ͡°)",
    description: "Appends a Lenny Face to your message ( ͡° ͜ʖ ͡°)",
  },
};

const otherCommands = {
  "nick-global": ({ actions }) => ({
    description:
      "Update your global nickname. This will be used if you don’t set a server specific nickname with the /nick command.",
    execute: async ({ args, editor }) => {
      const displayName = args.join(" ");
      await actions.updateMe({ displayName });
      editor.clear();
    },
  }),
  nick: ({ actions, context, serverId }) => ({
    description: "Update your nickname for this server",
    execute: async ({ args, editor }) => {
      const displayName = args.join(" ");
      await actions.updateMe({ displayName, serverId });
      editor.clear();
    },
    exclude: () => context === "dm",
  }),
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
  "update-channel": ({
    context,
    user,
    state,
    actions,
    serverId,
    channelId,
  }) => ({
    description: "Update a channel property",
    arguments: ["propery-name", "property-value"],
    execute: async ({ args, editor }) => {
      if (args.length < 2) {
        alert('Arguments #1 "property", and #2 "value", are required.');
        return;
      }
      const [property, ...valueWords] = args;
      const value = valueWords.join(" ");
      await actions.updateChannel(channelId, { [property]: value });
      editor.clear();
    },
    exclude: () => {
      if (context === "dm") {
        const channel = state.selectChannel(channelId);
        return user.id !== channel.ownerUserId;
      }

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

const removeCommandString = (editor, command) => {
  let [commandStart, commandEnd] = editor.search(`/${command}`, { at: [] });
  editor.select({ anchor: commandStart, focus: commandEnd });
  editor.deleteFragment();
  if (Editor.string(editor, []).startsWith(" ")) editor.deleteForward();
};

const prependTextCommand = (editor, text, command) => {
  removeCommandString(editor, command);
  editor.prependText(Editor.string(editor, []) === "" ? text : `${text} `);
  Transforms.select(editor, []);
  Transforms.collapse(editor, { edge: "end" });
};

const appendTextCommand = (editor, text, command) => {
  removeCommandString(editor, command);
  editor.appendText(Editor.string(editor, []) === "" ? text : ` ${text}`);
};

const useCommands = ({ context, serverId, channelId } = {}) => {
  const { user, signOut } = useAuth();
  const { state, actions } = useAppScope();
  const navigate = useNavigate();

  const commandDependencies = React.useMemo(
    () => ({
      user,
      navigate,
      state,
      actions,
      signOut,
      context,
      serverId,
      channelId,
    }),
    [user, navigate, state, actions, signOut, context, serverId, channelId]
  );

  const commands = React.useMemo(() => {
    const allCommands = {
      ...mapValues(
        ({ text, ...rest }, command) => ({
          ...rest,
          execute: async ({ editor }) => {
            prependTextCommand(editor, text, command);
          },
        }),
        prependTextCommands
      ),
      ...mapValues(
        ({ text, ...rest }, command) => ({
          ...rest,
          execute: async ({ editor }) => {
            appendTextCommand(editor, text, command);
          },
        }),
        appendTextCommands
      ),
      ...mapValues((fn) => fn(commandDependencies), otherCommands),
    };

    return Object.fromEntries(
      Object.entries(allCommands).filter(
        // eslint-disable-next-line no-unused-vars
        ([_, command]) => command.exclude == null || !command.exclude?.()
      )
    );
  }, [commandDependencies]);

  const isCommand = React.useCallback(
    (name) => Object.keys(commands).includes(name),
    [commands]
  );

  const execute = React.useCallback(
    (commandName, ...args) => {
      if (!isCommand(commandName)) throw new Error();
      return commands[commandName].execute(...args);
    },
    [isCommand, commands]
  );

  return { commands, isCommand, execute };
};

export default useCommands;
