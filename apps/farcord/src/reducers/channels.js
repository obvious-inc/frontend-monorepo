export const channelsReducer = (state, action) => {
  switch (action.type) {
    case "add-channel-by-parent-url": {
      const channelId = action.id;
      const data = { id: channelId, parentUrl: channelId, name: channelId };
      return {
        ...state,
        channelsById: {
          ...state.channelsById,
          [channelId]: {
            id: channelId,
            ...data,
          },
        },
      };
    }

    case "add-initial-channels": {
      return {
        ...state,
        channelsById: {
          ...state.channelsById,
          ...action.channelsById,
        },
      };
    }

    default: {
      throw Error("Unknown action: " + action.type);
    }
  }
};
