const commands = {
  "create-channel-section": ({ user, state, actions, serverId }) => ({
    description: "Create a new channel section",
    arguments: ["section-name"],
    execute: async ({ args, editor }) => {
      const name = args.join(" ");
      if (name.trim().length === 0) {
        alert('Missing "section-name" argument!');
        return;
      }
      await actions.createServerChannelSection(serverId, { name });
      editor.clear();
    },
    exclude: () => {
      const server = state.selectServer(serverId);
      return server?.ownerUserId !== user.id;
    },
  }),
  "delete-channel-section": ({ user, state, actions, serverId }) => ({
    description: "Delete a channel section",
    arguments: ["section-name"],
    execute: async ({ args, editor }) => {
      const name = args.join(" ");

      if (name.trim().length === 0) {
        alert('Missing "section-name" argument!');
        return;
      }

      const channelSections = state.selectServerChannelSections(serverId);
      const section = channelSections.find(
        (s) => s.name.toLowerCase() === name.toLowerCase()
      );

      if (section == null) {
        alert(`No section named "${name}"`);
        return;
      }

      if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

      await actions.deleteChannelSection(section.id);
      editor.clear();
    },
    exclude: () => {
      const server = state.selectServer(serverId);
      return server?.ownerUserId !== user.id;
    },
  }),
  "rename-channel-section": ({
    context,
    user,
    state,
    actions,
    serverId,
    channelId,
  }) => ({
    description: "Rename the current channel section",
    arguments: ["section-name"],
    execute: async ({ args, editor }) => {
      const name = args.join(" ");
      if (name.trim().length === 0) {
        alert('Missing "section-name" argument!');
        return;
      }
      const channelSection = state.selectChannelSection(channelId);
      await actions.updateChannelSection(channelSection.id, { name });
      editor.clear();
    },
    exclude: () => {
      if (context != "server-channel") return true;
      const server = state.selectServer(serverId);
      return server?.ownerUserId !== user.id;
    },
  }),
  "move-channel-to-section": ({
    context,
    user,
    state,
    actions,
    serverId,
    channelId,
  }) => ({
    description: "Add the current channel to the section with the given name",
    arguments: ["section-name"],
    execute: async ({ args, editor }) => {
      const name = args.join(" ");
      if (name.trim().length === 0) {
        alert('Missing "section-name" argument!');
        return;
      }

      const sections = state.selectServerChannelSections(serverId);
      const section = sections.find(
        (s) => s.name.toLowerCase() === name.toLowerCase()
      );

      if (section == null) {
        alert(`No section named "${name}"`);
        return;
      }

      const updatedSections = sections.map((s) => ({
        id: s.id,
        name: s.name,
        channelIds: (() => {
          if (s.id === section.id) return [...s.channelIds, channelId];
          return s.channelIds.filter((id) => id !== channelId);
        })(),
      }));

      await actions.updateServerChannelSections(serverId, updatedSections);
      editor.clear();
    },
    exclude: () => {
      if (context != "server-channel") return true;
      const server = state.selectServer(serverId);
      return server?.ownerUserId !== user.id;
    },
  }),
  "move-section": ({ context, user, state, actions, serverId, channelId }) => ({
    description: `Move the current section one step in the given direction ("up" or "down")`,
    arguments: ["direction"],
    execute: async ({ args, editor }) => {
      const [direction] = args;
      if (!["up", "down"].includes(direction)) {
        alert(`"${direction}" is not a valid direction!`);
        return;
      }

      const sections = state.selectServerChannelSections(serverId);
      const currentSection = state.selectChannelSection(channelId);
      const currentSectionIndex = sections.findIndex(
        (s) => s.id === currentSection.id
      );

      const nextIndex = Math.max(
        0,
        Math.min(
          sections.length - 1,
          direction === "up" ? currentSectionIndex - 1 : currentSectionIndex + 1
        )
      );

      const reorderedSections = [...sections];
      const temp = reorderedSections[nextIndex];
      reorderedSections[nextIndex] = currentSection;
      reorderedSections[currentSectionIndex] = temp;

      const updatedSections = reorderedSections.map((s, i) => ({
        ...s,
        position: i,
      }));

      await actions.updateServerChannelSections(serverId, updatedSections);
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
