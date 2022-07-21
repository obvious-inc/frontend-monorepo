export const getNoun = async (nounId) => {
  const [
    { ImageData, getNounSeedFromBlockHash, getRandomNounSeed, getNounData },
    { buildSVG },
  ] = await Promise.all([import("@nouns/assets"), import("@nouns/sdk")]);

  const { parts, background } = getNounData(seed);

  const svgBinary = buildSVG(parts, ImageData.palette, background);
  const svgBase64 = btoa(svgBinary);

  const url = `data:image/svg+xml;base64,${svgBase64}`;

  console.log("fetching noun", nounId);
  return null;
};

export const getRandomNoun = async () => {
  const [{ ImageData, getRandomNounSeed, getNounData }, { buildSVG }] =
    await Promise.all([import("@nouns/assets"), import("@nouns/sdk")]);

  const randomSeed = getRandomNounSeed();
  const { parts, background } = getNounData(randomSeed);

  const svgBinary = buildSVG(parts, ImageData.palette, background);
  const svgBase64 = btoa(svgBinary);

  const url = `data:image/svg+xml;base64,${svgBase64}`;
  return url;
};
