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

export const getNoun = async (nounId, provider) => {
  const [
    { ImageData, getNounData, getNounSeedFromBlockHash },
    { buildSVG, getContractAddressesForChainOrThrow },
    { NounsTokenABI },
    { Contract },
  ] = await Promise.all([
    import("@nouns/assets"),
    import("@nouns/sdk"),
    import("@nouns/contracts"),
    import("ethers"),
  ]);

  const contractAddresses = getContractAddressesForChainOrThrow(1);
  const tokenContract = new Contract(
    contractAddresses.nounsToken,
    NounsTokenABI,
    provider
  );
  const nounSeed = await tokenContract.seeds(nounId);
  let seed = {
    background: Number(nounSeed.background),
    body: Number(nounSeed.body),
    accessory: Number(nounSeed.accessory),
    head: Number(nounSeed.head),
    glasses: Number(nounSeed.glasses),
  };

  // if the seed is empty, it means the noun doesn't exist yet.
  const emptySeed = Object.values(seed).every(
    (element) => Number(element) == 0
  );

  if (emptySeed) {
    // generate a fresh noun using the current block
    const currBlockNumber = await provider.getBlockNumber();
    const currBlock = await provider.getBlock(currBlockNumber);
    seed = getNounSeedFromBlockHash(nounId, currBlock.hash);
  }

  const { parts, background } = getNounData(seed);

  const svgBinary = buildSVG(parts, ImageData.palette, background);
  const svgBase64 = btoa(svgBinary);

  const url = `data:image/svg+xml;base64,${svgBase64}`;
  return { url, parts, background, seed };
};
