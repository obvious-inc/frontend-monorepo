import { Editor, Transforms } from "slate";
import React from "react";
import { useAuth, useAppScope, objectUtils } from "@shades/common";

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
  nick: ({ actions }) => ({
    description: "Update your global nickname",
    execute: async ({ args, editor }) => {
      const displayName = args.join(" ");
      await actions.updateMe({ displayName });
      editor.clear();
    },
  }),
  "nick-server": ({ actions }) => ({
    description: "Update your nickname for this server",
    execute: async ({ args, editor, serverId }) => {
      const displayName = args.join(" ");
      await actions.updateMe({ displayName, serverId });
      editor.clear();
    },
  }),
  logout: ({ signOut }) => ({
    description: "Logs you out, really fast.",
    execute: async () => {
      signOut();
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

const useCommands = () => {
  const { signOut } = useAuth();
  const { actions } = useAppScope();

  const commandDependencies = React.useMemo(
    () => ({ actions, signOut }),
    [actions, signOut]
  );

  const commands = React.useMemo(() => {
    return {
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
