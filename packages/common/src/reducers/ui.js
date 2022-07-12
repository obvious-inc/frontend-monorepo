const initialState = {
  hasFetchedInitialData: false,
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case "initial-data-request-successful":
      return {
        ...state,
        hasFetchedInitialData: true,
      };

    case "fetch-client-boot-data-request-successful":
    case "fetch-user-channels-request-successful":
      return {
        ...state,
        hasFetchedUserChannels: true,
      };

    case "fetch-starred-channels-request-successful":
      return {
        ...state,
        hasFetchedStarredChannels: true,
      };

    case "logout":
      return initialState;

    default:
      return state;
  }
};

export const selectHasFetchedInitialData = (state) =>
  state.ui.hasFetchedInitialData;

export const selectHasFetchedMenuData = (state) =>
  state.ui.hasFetchedUserChannels && state.ui.hasFetchedStarredChannels;

export default reducer;
