import { Editor, Transforms } from "slate";
import { objectUtils } from "@shades/common";

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

const removeCommandString = (editor, command) => {
  let [commandStart, commandEnd] = editor.search(`/${command}`, { at: [] });
  editor.select({ anchor: commandStart, focus: commandEnd });
  editor.deleteFragment();
  if (Editor.string(editor, []).startsWith(" ")) editor.deleteForward();
};

const executePrependTextCommand = (editor, text, command) => {
  removeCommandString(editor, command);
  editor.prependText(Editor.string(editor, []) === "" ? text : `${text} `);
  Transforms.select(editor, []);
  Transforms.collapse(editor, { edge: "end" });
};

const executeAppendTextCommand = (editor, text, command) => {
  removeCommandString(editor, command);
  editor.appendText(Editor.string(editor, []) === "" ? text : ` ${text}`);
};

export default {
  ...mapValues(
    ({ text, ...rest }, command) => ({
      ...rest,
      execute: async ({ editor }) => {
        executePrependTextCommand(editor, text, command);
      },
    }),
    prependTextCommands
  ),
  ...mapValues(
    ({ text, ...rest }, command) => ({
      ...rest,
      execute: async ({ editor }) => {
        executeAppendTextCommand(editor, text, command);
      },
    }),
    appendTextCommands
  ),
};
