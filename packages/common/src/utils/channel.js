import { sort, comparator } from "./array";

export const search = (rawQuery, channels) => {
  const query = rawQuery.trim().toLowerCase();

  if (query.length <= 1) return [];

  const queryWords = query.split(" ").map((s) => s.trim());

  const match = (channel, query) => {
    if (channel.name?.toLowerCase().includes(query)) return true;
    return channel.members?.some((m) => m.displayName?.includes(query));
  };

  const unorderedChannels = channels.filter((c) =>
    queryWords.some((q) => match(c, q))
  );

  const orderedChannels = sort(
    comparator(
      {
        value: (c) => c.name?.toLowerCase().indexOf(query.toLowerCase()),
        type: "index",
      },
      { value: (c) => c.memberUserIds.length ?? Infinity }
    ),
    unorderedChannels
  );

  return orderedChannels;
};
