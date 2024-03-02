import { sort, comparator } from "./array.js";
import {
  match as matchString,
  getWordMatchCount as getStringWordMatchCount,
  getWords,
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
      (c) => {
        if (c.name == null || !matchString(c.name, query)) return Infinity;
        return c.name.length;
      },
      {
        value: (c) => {
          let matchCount = 0;

          // Split the query to make sure we don’t match more than one member
          // per word. Without this short queries will always match large
          // channels since a query like "a" often matches many members.
          for (const queryWord of getWords(query)) {
            const memberMatches = searchUsers(c.members ?? [], queryWord);
            if (memberMatches.length !== 0) matchCount += 1;
          }

          return matchCount;
        },
        order: "desc",
      },
      (c) => c.memberUserIds.length ?? Infinity,
      (c) => c.name?.toLowerCase(),
    ),
    unorderedChannels,
  );

  return orderedChannels;
};

export const createDefaultComparator = () =>
  comparator(
    {
      value: (c) => c.memberUserIds.length ?? 0,
      order: "desc",
    },
    (c) => c.name?.toLowerCase(),
  );
