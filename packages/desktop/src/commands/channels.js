const commands = {
  "create-channel": ({
    context,
    user,
    state,
    actions,
    serverId,
    navigate,
  }) => ({
    description: "Create a new channel",
    arguments: ["name"],
    execute: async ({ args, editor }) => {
      const name = args.join(" ");
      if (name.trim().length === 0) {
        alert('"name" is a required argument!');
        return;
      }
      const channel = await actions.createChannel({
        name,
        kind: "server",
        serverId,
      });
      editor.clear();
      navigate(`/channels/${serverId}/${channel.id}`);
    },
    exclude: () => {
      if (context != "server-channel") return true;
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
  "move-channel": ({ context, user, state, actions, serverId, channelId }) => ({
    description: `Move the current channel one step in the given direction ("up" or "down")`,
    arguments: ["direction"],
    execute: async ({ args, editor }) => {
      const [direction] = args;
      if (!["up", "down"].includes(direction)) {
        alert(`"${direction}" is not a valid direction!`);
        return;
      }

      const serverChannelSections = state.selectServerChannelSections(serverId);
      const currentSection = serverChannelSections.find((s) =>
        s.channelIds.includes(channelId)
      );

      if (currentSection == null) {
        alert(
          "Currently not possible to sort channels without a parent section, sorry!"
        );
        return;
      }

      const currentChannelIndex = currentSection.channelIds.indexOf(channelId);

      const nextIndex = Math.max(
        0,
        Math.min(
          currentSection.channelIds.length - 1,
          direction === "up" ? currentChannelIndex - 1 : currentChannelIndex + 1
        )
      );

      const reorderedChannelIds = [...currentSection.channelIds];
      const temp = reorderedChannelIds[nextIndex];
      reorderedChannelIds[nextIndex] = channelId;
      reorderedChannelIds[currentChannelIndex] = temp;

      await actions.updateChannelSection(currentSection.id, {
        channelIds: reorderedChannelIds,
      });
      editor.clear();
    },
    exclude: () => {
      if (context != "server-channel") return true;
      const server = state.selectServer(serverId);
      return server?.ownerUserId !== user.id;
    },
  }),
};

export default commands;
