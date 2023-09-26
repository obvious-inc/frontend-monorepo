export const channelsReducer = (state, action) => {
  switch (action.type) {
    case "add-channel": {
      return {
        ...state,
        channelsById: {
          ...state.channelsById,
          [action.id]: {
            id: action.id,
            ...action.value,
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
