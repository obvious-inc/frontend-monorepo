import { CHAIN_ID } from "../constants/env.js";

const getEtherscanLinkHost = () => {
  switch (CHAIN_ID) {
    case 1:
      return "https://etherscan.io";
    case 11155111:
      return "https://sepolia.etherscan.io";
    default:
      throw new Error();
  }
};

export const buildEtherscanLink = (path) => {
  return `${getEtherscanLinkHost()}${path}`;
};
