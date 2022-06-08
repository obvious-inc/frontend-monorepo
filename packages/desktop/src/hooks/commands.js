import React from "react";
import { useNavigate } from "react-router-dom";
import { useProvider as useEthersProvider } from "wagmi";
import { useAuth, useAppScope, objectUtils } from "@shades/common";
import textCommands from "../commands/text";
import userCommands from "../commands/user";
import channelCommands from "../commands/channels";
import channelSectionCommands from "../commands/channel-sections";
import miscCommands from "../commands/misc";

const { mapValues, filter: filterObject } = objectUtils;

const allCommands = {
  ...textCommands,
  ...userCommands,
  ...channelCommands,
  ...channelSectionCommands,
  ...miscCommands,
};

const useCommands = ({ context, serverId, channelId } = {}) => {
  const { user } = useAuth();
  const { state, actions } = useAppScope();
  const navigate = useNavigate();
  const ethersProvider = useEthersProvider();

  const commandDependencies = React.useMemo(
    () => ({
      user,
      navigate,
      state,
      actions,
      context,
      serverId,
      channelId,
      ethersProvider,
    }),
    [
      user,
      navigate,
      state,
      actions,
      context,
      serverId,
      channelId,
      ethersProvider,
    ]
  );

  const commands = React.useMemo(() => {
    const commandsWithDependeciesInjected = mapValues((command) => {
      if (typeof command !== "function") return command;
      return command(commandDependencies);
    }, allCommands);

    return filterObject(
      // eslint-disable-next-line no-unused-vars
      ([_, command]) => command.exclude == null || !command.exclude?.(),
      commandsWithDependeciesInjected
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
