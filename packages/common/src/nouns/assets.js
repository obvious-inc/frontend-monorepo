import {
  ImageData,
  getNounSeedFromBlockHash,
  getNounData,
} from "@nouns/assets";
import { buildSVG } from "@nouns/sdk";

const svgCacheBySeed = new Map();

const buildSvgStringFromSeed = (seed, { transparent = false } = {}) => {
  let cacheKey = [
    seed.background,
    seed.body,
    seed.accessory,
    seed.head,
    seed.glasses,
  ].join("-");

  if (transparent) cacheKey += "-t";

  if (svgCacheBySeed.has(cacheKey)) return svgCacheBySeed.get(cacheKey);

  const { parts, background } = getNounData(seed);

  return buildSVG(
    parts,
    ImageData.palette,
    transparent ? "00000000" : background
  );
};

const buildDataUriFromSvgString = (svgString) => {
  const svgBase64 = btoa(svgString);
  return `data:image/svg+xml;base64,${svgBase64}`;
};

const getPseudorandomAccountSeed = (address) => {
  const paddedAddress = `0x${address.replace("0x", "").padStart(32 * 2, "0")}`;
  return getNounSeedFromBlockHash(0, paddedAddress);
};

export const buildAccountPlaceholderSvgString = (accountAddress, options) => {
  const seed = getPseudorandomAccountSeed(accountAddress);
  return buildSvgStringFromSeed(seed, options);
};

export const buildAccountPlaceholderDataUri = (accountAddress, options) => {
  const svgString = buildAccountPlaceholderSvgString(accountAddress, options);
  return buildDataUriFromSvgString(svgString);
};

export const buildDataUriFromSeed = (seed, options) => {
  const svgString = buildSvgStringFromSeed(seed, options);
  return buildDataUriFromSvgString(svgString);
};
