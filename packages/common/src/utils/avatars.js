import {
  ImageData,
  getNounSeedFromBlockHash,
  getNounData,
} from "@nouns/assets";
import { buildSVG } from "@nouns/sdk";
import { pad as padHex } from "viem";

const cache = new Map();

export const generatePlaceholderSvgString = async (
  walletAddress,
  { transparent = false } = {}
) => {
  const cacheKey = walletAddress;

  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const seed = getNounSeedFromBlockHash(0, padHex(walletAddress));
  const { parts, background } = getNounData(seed);

  return buildSVG(
    parts,
    ImageData.palette,
    transparent ? "00000000" : background
  );
};

export const generatePlaceholderDataUri = async (walletAddress, options) => {
  const svgString = await generatePlaceholderSvgString(walletAddress, options);
  const svgBase64 = btoa(svgString);
  const uri = `data:image/svg+xml;base64,${svgBase64}`;
  return uri;
};
