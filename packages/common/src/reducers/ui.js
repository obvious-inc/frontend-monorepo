const initialState = {
  hasFetchedUserChannels: false,
  hasFetchedStarredChannels: false,
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case "fetch-client-boot-data-request-successful":
    case "fetch-user-channels-request-successful":
      return {
        ...state,
        hasFetchedUserChannels: true,
      };

    case "fetch-starred-items:request-successful":
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

export const selectHasFetchedUserChannels = (state) =>
  state.ui.hasFetchedUserChannels;

export const selectHasFetchedMenuData = (state) =>
  state.ui.hasFetchedUserChannels && state.ui.hasFetchedStarredChannels;

export default reducer;
