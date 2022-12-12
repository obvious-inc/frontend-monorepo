import combineReducers from "./utils/combine-reducers.js";
import me from "./reducers/me.js";
import ui from "./reducers/ui.js";
import channels from "./reducers/channels.js";
import messages from "./reducers/messages.js";
import users from "./reducers/users.js";
import channelTypingStatus from "./reducers/channel-typing-status.js";
import apps from "./reducers/apps.js";
import ens from "./reducers/ens.js";

export default combineReducers({
  me,
  channels,
  users,
  messages,
  channelTypingStatus,
  apps,
  ens,
  ui,
});
