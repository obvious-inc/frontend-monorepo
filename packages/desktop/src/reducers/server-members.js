import { mapValues } from "../utils/object";
import { indexBy, groupBy } from "../utils/array";

const initialState = {
  entriesById: {},
  entriesByUserId: {},
  entryIdsByServerId: [],
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case "user-data":
      const members = action.data.servers.flatMap((s) => s.members);
      const membersById = indexBy((m) => m.id, members);
      const membersByUserId = indexBy((m) => m.user, members);
      const memberIdsByServerId = mapValues(
        (members) => members.map((m) => m.id),
        groupBy((m) => m.server, members)
      );

      return {
        entriesById: membersById,
        entriesByUserId: membersByUserId,
        entryIdsByServerId: memberIdsByServerId,
      };
    default:
      return state;
  }
};

export const selectServerMembersByUserId = (state) => (serverId) => {
  const memberIds = state.serverMembers.entryIdsByServerId[serverId] ?? [];
  return indexBy(
    (m) => m.user,
    memberIds.map((id) => state.serverMembers.entriesById[id])
  );
};

export default reducer;
