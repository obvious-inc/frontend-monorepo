import { sort, comparator } from "./array.js";
import {
  match as matchString,
  getWords as getStringWords,
  getWordMatchCount as getStringWordMatchCount,
} from "./string.js";

export const search = (emoji, rawQuery) => {
  const query = rawQuery.trim().toLowerCase();

  const buildMatchTokens = (emoji) => [
    emoji.description,
    ...emoji.aliases,
    ...emoji.tags,
  ];

  const buildMatchString = (emoji) => buildMatchTokens(emoji).join(" ");

  const match = (emoji) => matchString(buildMatchString(emoji), query);

  const unorderedItems = emoji.filter(match);

  const orderedItems = sort(
    comparator(
      {
        value: (e) =>
          buildMatchTokens(e).findIndex(
            (t) =>
              getStringWords(query).filter((w) => w === t.toLowerCase())
                .length > 0
          ),
        type: "index",
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
          const tokens = [e.description, ...e.aliases, ...e.tags];

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
            [Infinity, Infinity]
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
      (e) => e.description
    ),
    unorderedItems
  );

  return orderedItems;
};
