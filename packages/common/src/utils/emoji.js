import { sort, comparator } from "./array.js";
import {
  match as matchString,
  getWordMatchCount as getStringWordMatchCount,
} from "./string.js";

export const search = (emoji, rawQuery) => {
  const query = rawQuery.trim().toLowerCase();

  const buildAliasTokens = (emoji) => [...emoji.aliases, ...emoji.tags];
  const buildMatchTokens = (emoji) => [
    ...buildAliasTokens(emoji),
    emoji.description,
  ];

  const buildMatchString = (emoji) => buildMatchTokens(emoji).join(" ");

  const match = (emoji) => matchString(buildMatchString(emoji), query);

  const unorderedItems = emoji.filter(match);

  const orderedItems = sort(
    comparator(
      {
        value: (e) =>
          buildAliasTokens(e).findIndex((t) => t.toLowerCase() === query),
        type: "index",
      },
      {
        value: (e) => {
          if (!e.aliases[0].toLowerCase().startsWith(query)) return Infinity;
          return e.aliases[0].length;
        },
      },
      {
        value: (e) => {
          if (!e.aliases[0].toLowerCase().includes(query)) return Infinity;
          return e.aliases[0].length;
        },
      },
      {
        value: (e) => {
          const token = buildAliasTokens(e).find((t) =>
            t.toLowerCase().startsWith(query),
          );
          return token?.length ?? Infinity;
        },
      },
      {
        value: (e) =>
          getStringWordMatchCount(buildMatchString(e), query, { exact: true }),
        order: "desc",
      },
      {
        value: (e) => getStringWordMatchCount(buildMatchString(e), query),
        order: "desc",
      },
      {
        value: (e) => {
          const tokens = [e.description, ...e.aliases, ...(e.tags ?? [])];

          const [matchIndex, matchStringLength] = tokens.reduce(
            (best, s) => {
              const [minMatchIndex, matchStringLength] = best;
              const index = s.toLowerCase().indexOf(query);

              if (index === -1) return best;
              if (index < minMatchIndex) return [index, s.length];
              if (index === minMatchIndex)
                return [index, Math.min(matchStringLength, s.length)];

              return best;
            },
            [Infinity, Infinity],
          );

          if (matchIndex === Infinity) return Infinity;

          const binaryScoreRepresentation = [matchIndex, matchStringLength]
            .map((n) => n.toString(2).padStart(8, "0")) // Assuming n is 0-255 here, IT’S FINE!
            .join("");
          const score = parseInt(binaryScoreRepresentation, 2);
          return score;
        },
        type: "index",
      },
      {
        value: (e) => e.description.length,
        order: "asc",
      },
      (e) => e.description,
    ),
    unorderedItems,
  );

  return orderedItems;
};

// https://stackoverflow.com/a/64007175/1460918
export const isEmoji = (maybeEmoji) =>
  /\p{Extended_Pictographic}/u.test(maybeEmoji);
