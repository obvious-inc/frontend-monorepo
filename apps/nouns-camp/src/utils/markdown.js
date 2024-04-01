const REPOST_MARKED_QUOTE_MARK_REGEX_STRING = "\\+1";

const buildMarkedQuoteRegexString = (markRegexString) =>
  `(?:^|(?:\\n *\\n))${markRegexString} ?\\n *\\n(?:> *[^\\s]+.*(?:\\n|$))(?:> *[^\\s]*.*(?:\\n|$))*`;

const extractMarkedQuotes = (mark, markdown) => {
  const matches = markdown.match(
    new RegExp(buildMarkedQuoteRegexString(mark), "g"),
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

const stripMarkedQuotes = (mark, markdown, indeciesToDrop) => {
  const matches = markdown.match(
    new RegExp(buildMarkedQuoteRegexString(mark), "g"),
  );
  if (matches == null) return markdown;

  let stippedMarkdown = markdown;

  for (const [index, match] of matches.entries()) {
    if (indeciesToDrop != null && !indeciesToDrop.includes(index)) continue;
    stippedMarkdown = stippedMarkdown.replace(match.trim(), "");
  }

  return stippedMarkdown;
};

export const extractRepostQuotes = (markdown) =>
  extractMarkedQuotes(REPOST_MARKED_QUOTE_MARK_REGEX_STRING, markdown);

export const stripRepostQuotes = (markdown, indeciesToDrop) =>
  stripMarkedQuotes(
    REPOST_MARKED_QUOTE_MARK_REGEX_STRING,
    markdown,
    indeciesToDrop,
  );
