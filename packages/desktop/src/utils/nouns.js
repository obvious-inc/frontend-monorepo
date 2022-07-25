export const getRandomNoun = async () => {
  const [{ ImageData, getRandomNounSeed, getNounData }, { buildSVG }] =
    await Promise.all([import("@nouns/assets"), import("@nouns/sdk")]);

  const randomSeed = getRandomNounSeed();
  const { parts, background } = getNounData(randomSeed);

  const svgBinary = buildSVG(parts, ImageData.palette, background);
  const svgBase64 = btoa(svgBinary);

  const url = `data:image/svg+xml;base64,${svgBase64}`;
  return { url, parts, background, seed: randomSeed };
};
