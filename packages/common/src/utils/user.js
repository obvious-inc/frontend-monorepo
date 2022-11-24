import { sort, comparator } from "./array.js";
import {
  match as matchString,
  getWordMatchCount as getStringWordMatchCount,
} from "./string.js";

export const search = (users, rawQuery) => {
  const query = rawQuery.trim().toLowerCase();

  const matchUser = (user) => {
    const name = user.customDisplayName ?? user.displayName;
    const address = user.walletAddress;
    const ensName = user.ensName;

    return [name, address, ensName]
      .filter((p) => (p ?? "").trim() !== "")
      .some((s) => matchString(s, query));
  };

  const unorderedUsers = users.filter(matchUser);

  const orderedUsers = sort(
    comparator(
      (u) => u.isStarred,
      {
        value: (u) =>
          getStringWordMatchCount(u.displayName ?? "", query, { exact: true }),
        order: "desc",
      },
      {
        value: (u) => getStringWordMatchCount(u.displayName ?? "", query),
        order: "desc",
      },
      {
        value: (u) => u.displayName?.toLowerCase().indexOf(query.toLowerCase()),
        type: "index",
      },
      (u) => {
        if (!matchString(u.displayName ?? "", query)) return Infinity;
        return u.displayName.length;
      },
      (u) => u.displayName?.toLowerCase()
    ),
    unorderedUsers
  );

  return orderedUsers;
};
