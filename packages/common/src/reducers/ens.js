import combineReducers from "../utils/combine-reducers";

const namesByAddress = (state = {}, action) => {
  switch (action.type) {
    case "resolve-ens-names:request-successful":
      return { ...state, ...action.namesByAddress };

    default:
      return state;
  }
};

export const selectEnsName = (state, walletAddress) =>
  state.ens.namesByAddress[walletAddress.toLowerCase()];

export default combineReducers({ namesByAddress });
