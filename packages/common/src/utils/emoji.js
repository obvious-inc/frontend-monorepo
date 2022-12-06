import { sort, comparator } from "./array.js";
import {
  match as matchString,
  getWordMatchCount as getStringWordMatchCount,
} from "./string.js";

export const search = (emoji, rawQuery) => {
  const query = rawQuery.trim().toLowerCase();

  const buildMatchString = (emoji) =>
    [emoji.description, ...emoji.aliases, ...emoji.tags].join(" ");

  const match = (emoji) => matchString(buildMatchString(emoji), query);

  const unorderedItems = emoji.filter(match);

  const orderedItems = sort(
    comparator(
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
          return [e.description, ...e.aliases, ...e.tags].reduce((min, s) => {
            const index = s.toLowerCase().indexOf(query);
            if (index !== -1 && index < min) return index;
            return min;
          }, Infinity);
        },
        type: "index",
      },
      (e) => e.description
    ),
    unorderedItems
  );

  return orderedItems;
};
