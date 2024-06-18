const buildMarkedQuoteRegexString = (markRegexString) =>
  `(?:^|(?:\\n *\\n))${markRegexString} ?\\n *\\n(?:> *[^\\s]+.*(?:\\n|$))(?:> *[^\\s]*.*(?:\\n|$))*`;

export const getMarkedQuoteBodies = (mark, markdown) => {
  const matches = markdown.match(
    new RegExp(buildMarkedQuoteRegexString(mark), "gm"),
  );
  if (matches == null) return [];
  return matches.map((m) =>
    m
      .trim()
      .split("\n")
      .slice(2)
      .map((line) => {
        if (line[1] === " ") return line.slice(2);
        return line.slice(1);
      })
      .join("\n"),
  );
};

export const stripMarkedQuotes = (mark, markdown, indeciesToDrop) => {
  const matches = markdown.match(
    new RegExp(buildMarkedQuoteRegexString(mark), "gm"),
  );
  if (matches == null) return markdown;

  let stippedMarkdown = markdown;

  for (const [index, match] of matches.entries()) {
    if (indeciesToDrop != null && !indeciesToDrop.includes(index)) continue;
    stippedMarkdown = stippedMarkdown.replace(match.trim(), "");
  }

  return stippedMarkdown;
};
