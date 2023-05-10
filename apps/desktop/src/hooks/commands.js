import React from "react";
import { useNavigate } from "react-router-dom";
import { usePublicClient as usePublicEthereumClient } from "wagmi";
import { useActions, useSelectors, useMe } from "@shades/common/app";
import { object as objectUtils } from "@shades/common/utils";
import textCommands from "../commands/text";
import userCommands from "../commands/user";
import channelCommands from "../commands/channels";
import miscCommands from "../commands/misc";

const { mapValues, filter: filterObject } = objectUtils;

const useCommands = ({ context, channelId } = {}) => {
  const actions = useActions();
  const selectors = useSelectors();
  const navigate = useNavigate();
  const publicEthereumClient = usePublicEthereumClient();
  const user = useMe();

  const commandDependencies = React.useMemo(
    () => ({
      user,
      navigate,
      actions,
      context,
      channelId,
      publicEthereumClient,
      state: selectors,
    }),
    [
      user,
      navigate,
      actions,
      context,
      channelId,
      publicEthereumClient,
      selectors,
    ]
  );

  const commands = React.useMemo(() => {
    if (user == null || commandDependencies.channelId == null)
      return textCommands;

    const allCommands = {
      ...textCommands,
      ...userCommands,
      ...channelCommands,
      ...miscCommands,
    };

    const commandsWithDependeciesInjected = mapValues((command) => {
      if (typeof command !== "function") return command;
      return command(commandDependencies);
    }, allCommands);

    return filterObject(
      // eslint-disable-next-line no-unused-vars
      ([_, command]) => command.exclude == null || !command.exclude?.(),
      commandsWithDependeciesInjected
    );
  }, [user, commandDependencies]);

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
