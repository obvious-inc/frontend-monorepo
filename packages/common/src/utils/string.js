export const getWords = (string) => string.trim().split(/[\s,.]+/);

export const match = (string, query) => {
  const normalizedString = string.toLowerCase();
  return getWords(query.toLowerCase()).some((w) =>
    normalizedString.includes(w)
  );
};

export const getWordMatchCount = (string, query, { exact = false } = {}) => {
  const queryWords = getWords(query.toLowerCase());
  const normalizedString = string.toLowerCase();

  if (exact) {
    const stringWords = getWords(normalizedString);
    const matchingWords = queryWords.filter((qw) =>
      stringWords.some((sw) => sw === qw)
    );
    return matchingWords.length;
  }

  const matchingWords = queryWords.filter((w) => normalizedString.includes(w));

  return matchingWords.length;
};
