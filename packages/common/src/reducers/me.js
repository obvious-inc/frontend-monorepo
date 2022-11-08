import combineReducers from "../utils/combine-reducers";
import { selectUser } from "./users";

const user = (state = null, action) => {
  switch (action.type) {
    case "fetch-me-request-successful":
    case "fetch-client-boot-data-request-successful":
      return { id: action.user.id };

    case "logout":
      return null;

    default:
      return state;
  }
};

export const selectMe = (state) =>
  state.me.user == null ? null : selectUser(state, state.me.user?.id);

export default combineReducers({ user });
