import { sort, comparator } from "./array.js";
import {
  match as matchString,
  getWordMatchCount as getStringWordMatchCount,
} from "./string.js";

export const search = (channels, rawQuery) => {
  const query = rawQuery.trim().toLowerCase();

  const matchChannel = (channel) => {
    if (channel.name == null)
      return channel.members?.some(
        (m) => m.displayName != null && matchString(m.displayName, query)
      );

    return matchString(channel.name, query);
  };

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
        if (!matchString(c.name ?? "", query)) return Infinity;
        return c.name.length;
      },
      (c) => c.memberUserIds.length ?? Infinity,
      (c) => c.name?.toLowerCase()
    ),
    unorderedChannels
  );

  return orderedChannels;
};
