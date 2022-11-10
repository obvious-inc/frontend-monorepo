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

const notificationSettingsByChannelId = (state = {}, action) => {
  switch (action.type) {
    case "fetch-preferences:request-successful":
      return action.notificationSettingsByChannelId;
    case "set-channel-notification-setting:request-sent":
      return { ...state, [action.channelId]: action.setting };
    default:
      return state;
  }
};

export const selectMe = (state) =>
  state.me.user == null ? null : selectUser(state, state.me.user?.id);

export const selectChannelNotificationSetting = (state, channelId) =>
  state.me.notificationSettingsByChannelId[channelId] ?? "all";

export default combineReducers({ user, notificationSettingsByChannelId });
