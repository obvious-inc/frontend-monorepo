import combineReducers from "../utils/combine-reducers";

const entriesByAddress = (state = {}, action) => {
  switch (action.type) {
    case "fetch-ens-entries:request-successful":
      return { ...state, ...action.entriesByAddress };

    default:
      return state;
  }
};

export const selectEnsName = (state, walletAddress) =>
  state.ens.entriesByAddress[walletAddress?.toLowerCase()]?.name;

export const selectEnsAvatar = (state, walletAddress) =>
  state.ens.entriesByAddress[walletAddress?.toLowerCase()]?.avatar;

export default combineReducers({ entriesByAddress });
