import { base, mainnet, sepolia } from "viem/chains";
import { CHAIN_ID } from "../constants/env.js";

const getEtherscanLinkHost = (chainId) => {
  switch (chainId) {
    case mainnet.id:
      return "https://etherscan.io";
    case sepolia.id:
      return "https://sepolia.etherscan.io";
    case base.id:
      return "https://basescan.org";
    default:
      throw new Error();
  }
};

export const buildEtherscanLink = (path, { chainId = CHAIN_ID } = {}) => {
  return `${getEtherscanLinkHost(chainId)}${path}`;
};
