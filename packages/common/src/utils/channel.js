import { sort, comparator } from "./array.js";
import {
  match as matchString,
  getWordMatchCount as getStringWordMatchCount,
} from "./string.js";
import { search as searchUsers } from "./user.js";

export const search = (channels, rawQuery) => {
  if (channels.length === 0) return [];

  const query = rawQuery.trim().toLowerCase();

  const matchChannel = (channel) =>
    matchString(channel.name ?? "", query) ||
    searchUsers(channel.members ?? [], query).length > 0;

  const unorderedChannels = channels.filter(matchChannel);

  const orderedChannels = sort(
    comparator(
      {
        value: (c) =>
          getStringWordMatchCount(c.name ?? "", query, { exact: true }),
        order: "desc",
      },
      {
        value: (c) => getStringWordMatchCount(c.name ?? "", query),
        order: "desc",
      },
      {
        value: (c) => c.name?.toLowerCase().indexOf(query.toLowerCase()),
        type: "index",
      },
      {
        value: (c) => {
          const memberMatches = searchUsers(c.members ?? [], query);
          return memberMatches.length;
        },
        order: "desc",
      },
      (c) => {
        if (c.name == null || !matchString(c.name, query)) return Infinity;
        return c.name.length;
      },
      (c) => c.memberUserIds.length ?? Infinity,
      (c) => c.name?.toLowerCase()
    ),
    unorderedChannels
  );

  return orderedChannels;
};

export const createDefaultComparator = () =>
  comparator(
    {
      value: (c) => c.memberUserIds.length ?? 0,
      order: "desc",
    },
    (c) => c.name?.toLowerCase()
  );
