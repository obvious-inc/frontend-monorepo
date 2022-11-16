import { sort } from "./array";

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

  const compareStringGivenQuery = (query) => (s1, s2) => {
    const [i1, i2] = [s1, s2].map((s) =>
      s?.toLowerCase().indexOf(query.toLowerCase())
    );

    // None match
    if (i1 === -1 && i2 === -1) return 0;

    // Single match
    if (i1 === -1) return 1;
    if (i2 === -1) return -1;

    // If both match, pick the first
    if (i1 < i2) return -1;
    if (i1 > i2) return 1;

    // Given the same index, pick the shortest string
    const [l1, l2] = [s1, s2].map((s) => s.length);
    if (l1 < l2) return -1;
    if (l1 > l2) return 1;

    return 0;
  };

  const compareString = compareStringGivenQuery(query);

  const orderedChannels = sort((c1, c2) => {
    const nameResult = compareString(...[c1, c2].map((c) => c.name));

    if (nameResult !== 0) return nameResult;

    // If name comparison is equal, order channels by member count, ascending
    const [ms1, ms2] = [c1, c2].map((c) => c.memberUserIds?.length ?? Infinity);

    if (ms1 < ms2) return -1;
    if (ms1 > ms2) return 1;

    return 0;
  }, unorderedChannels);

  return orderedChannels;
};
